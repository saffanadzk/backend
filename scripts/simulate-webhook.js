const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');

// Muat .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
const port = process.env.PORT || 3000;

const args = process.argv.slice(2);
const orderId = args[0];
const amountInput = args[1];
const targetStatus = args[2] || 'settlement';

if (!orderId || !amountInput) {
  console.log(`
========================================================================
 Penggunaan Script Simulasi Webhook Midtrans:
 node scripts/simulate-webhook.js <order_id> <amount> [status]

 Contoh:
 node scripts/simulate-webhook.js PAY-1732280000-A1B2C3D4 150000
 node scripts/simulate-webhook.js PAY-1732280000-A1B2C3D4 150000 expire
========================================================================
`);
  process.exit(1);
}

if (!serverKey) {
  console.error('[Error] MIDTRANS_SERVER_KEY tidak ditemukan di .env!');
  process.exit(1);
}

const statusCode = '200';
// Format gross_amount dengan 2 desimal string apa adanya dari Midtrans (contoh: "150000.00")
const grossAmountStr = `${parseInt(amountInput, 10)}.00`;

// Hitung signature SHA-512
const signatureRaw = `${orderId}${statusCode}${grossAmountStr}${serverKey}`;
const signatureKey = crypto.createHash('sha512').update(signatureRaw).digest('hex');

// Format waktu WIB: "YYYY-MM-DD HH:mm:ss"
const now = new Date();
const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
const timeStr = wibTime.toISOString().replace('T', ' ').slice(0, 19);

const payload = {
  order_id: orderId,
  status_code: statusCode,
  gross_amount: grossAmountStr,
  signature_key: signatureKey,
  transaction_status: targetStatus,
  fraud_status: 'accept',
  payment_type: 'bank_transfer',
  settlement_time: targetStatus === 'settlement' ? timeStr : undefined,
  transaction_time: timeStr,
  transaction_id: `SIM-${Date.now()}`,
};

const webhookUrl = `http://localhost:${port}/api/payments/notification`;

console.log(`[Simulasi Webhook] Mengirim notifikasi "${targetStatus}" ke: ${webhookUrl}`);
console.log(`- Order ID    : ${orderId}`);
console.log(`- Gross Amount: ${grossAmountStr}`);
console.log(`- Signature   : ${signatureKey.slice(0, 20)}...`);

fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})
  .then(async (res) => {
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    console.log(`[Hasil Respon Webhook] HTTP ${res.status}`);
    console.log(JSON.stringify(body, null, 2));

    if (res.ok) {
      console.log('✓ Simulasi Webhook berhasil diproses!');
    } else {
      console.error('✗ Webhook gagal atau ditolak oleh server.');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(`[Error Koneksi] Pastikan server Express aktif di port ${port}:`, err.message);
    process.exit(1);
  });
