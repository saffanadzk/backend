const prisma = require('../config/prisma');
const { generateOrderId } = require('../utils/generator');
const { toWibIsoString, parseMidtransWibTime } = require('../utils/date');
const { createSnapTransaction, verifyWebhookSignature } = require('./midtransService');

/**
 * Callback saat status pembayaran berubah.
 * // TODO: Nanti modul order yang mengisinya (misal: update status pesanan, kirim notifikasi ke pembeli/penjual)
 */
function onPaymentStatusChanged(payment) {
  console.log(`[EVENT onPaymentStatusChanged] Status pembayaran order ${payment.order_id} berubah menjadi: "${payment.status}"`);
}

/**
 * Membuat transaksi pembayaran baru via Midtrans Snap dan menyimpannya di DB.
 */
async function createPayment({ amount, items, customer, reference_id, metadata }) {
  // 1. Generate order_id unik Midtrans: PAY-<timestamp>-<random hex>
  const orderId = generateOrderId();

  // 2. Tentukan expiry waktu 60 menit
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // 3. Panggil API Midtrans Snap createTransaction
  const snapResult = await createSnapTransaction({
    orderId,
    amount,
    items,
    customer,
  });

  // 4. Simpan ke database dengan status "pending"
  const payment = await prisma.payment.create({
    data: {
      order_id: orderId,
      reference_id: reference_id ? String(reference_id) : null,
      gross_amount: amount,
      status: 'pending',
      snap_token: snapResult.token,
      redirect_url: snapResult.redirect_url,
      customer_details: customer ? JSON.stringify(customer) : null,
      item_details: JSON.stringify(items),
      metadata: metadata ? JSON.stringify(metadata) : null,
      expires_at: expiresAt,
    },
  });

  // 5. Kembalikan data sesuai kontrak API
  return {
    payment_id: payment.id,
    order_id: payment.order_id,
    token: payment.snap_token,
    redirect_url: payment.redirect_url,
    status: payment.status,
    expires_at: toWibIsoString(payment.expires_at),
  };
}

/**
 * Mengambil detail status pembayaran berdasarkan order_id Midtrans.
 */
async function getPaymentByOrderId(orderId) {
  const payment = await prisma.payment.findUnique({
    where: { order_id: orderId },
  });

  if (!payment) {
    return null;
  }

  // Format respons dengan zona waktu Asia/Jakarta (+07:00)
  return {
    order_id: payment.order_id,
    reference_id: payment.reference_id,
    amount: payment.gross_amount,
    status: payment.status,
    payment_type: payment.payment_type || null,
    created_at: toWibIsoString(payment.created_at),
    expires_at: toWibIsoString(payment.expires_at),
    paid_at: toWibIsoString(payment.paid_at),
  };
}

/**
 * Memproses notifikasi webhook HTTP POST dari Midtrans secara idempotent.
 */
async function handleWebhookNotification(body) {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    payment_type,
    settlement_time,
    transaction_time,
  } = body;

  // 1. Verifikasi Signature: SHA512(order_id + status_code + gross_amount + SERVER_KEY)
  const isSignatureValid = verifyWebhookSignature({
    order_id,
    status_code,
    gross_amount,
    signature_key,
  });

  if (!isSignatureValid) {
    const error = new Error('Signature key tidak valid');
    error.status = 403;
    throw error;
  }

  // 2. Ambil data payment dari DB
  const payment = await prisma.payment.findUnique({
    where: { order_id },
  });

  if (!payment) {
    console.warn(`[Webhook Warning] Order ID "${order_id}" tidak ditemukan di database.`);
    const error = new Error('Order tidak ditemukan');
    error.status = 404;
    throw error;
  }

  // 3. Idempotent: jika status di DB sudah "lunas", abaikan notifikasi berikutnya (jangan timpa paid_at atau turunkan status)
  if (payment.status === 'lunas') {
    console.log(`[Webhook] Order ${order_id} sudah berstatus "lunas". Mengabaikan notifikasi ulang.`);
    return payment;
  }

  // 4. Mapping transaction_status Midtrans ke status aplikasi
  let newStatus = payment.status;
  const txStatus = String(transaction_status || '').toLowerCase();
  const frStatus = String(fraud_status || '').toLowerCase();

  if (txStatus === 'capture') {
    newStatus = frStatus === 'accept' ? 'lunas' : 'challenge';
  } else if (txStatus === 'settlement') {
    newStatus = 'lunas';
  } else if (txStatus === 'pending') {
    newStatus = 'pending';
  } else if (txStatus === 'deny' || txStatus === 'cancel') {
    newStatus = 'gagal';
  } else if (txStatus === 'expire') {
    newStatus = 'kadaluarsa';
  }

  // 5. Hitung waktu lunas (paid_at) jika status menjadi lunas
  let paidAt = payment.paid_at;
  if (newStatus === 'lunas') {
    const timeSource = settlement_time || transaction_time;
    if (timeSource) {
      paidAt = parseMidtransWibTime(timeSource);
    } else if (!paidAt) {
      paidAt = new Date();
    }
  }

  // 6. Update database secara aman
  const updatedPayment = await prisma.payment.update({
    where: { order_id },
    data: {
      status: newStatus,
      payment_type: payment_type || payment.payment_type,
      paid_at: paidAt,
      raw_notification: JSON.stringify(body),
    },
  });

  // 7. Panggil callback status changed
  onPaymentStatusChanged(updatedPayment);

  return updatedPayment;
}

module.exports = {
  createPayment,
  getPaymentByOrderId,
  handleWebhookNotification,
  onPaymentStatusChanged,
};
