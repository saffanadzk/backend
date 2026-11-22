const crypto = require('crypto');
const midtransClient = require('midtrans-client');
const env = require('../config/env');

let mockSnapClient = null;

function getSnapClient() {
  if (mockSnapClient) return mockSnapClient;

  return new midtransClient.Snap({
    isProduction: env.MIDTRANS.IS_PRODUCTION,
    serverKey: env.MIDTRANS.SERVER_KEY,
    clientKey: env.MIDTRANS.CLIENT_KEY,
  });
}

function setMockSnapClient(mock) {
  mockSnapClient = mock;
}

/**
 * Membuat transaksi Snap di Midtrans dengan batas waktu (expiry) 60 menit.
 */
async function createSnapTransaction({ orderId, amount, items, customer }) {
  const snap = getSnapClient();

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: items,
    customer_details: customer || undefined,
    expiry: {
      unit: 'minute',
      duration: 60,
    },
  };

  const transaction = await snap.createTransaction(parameter);
  return {
    token: transaction.token,
    redirect_url: transaction.redirect_url,
  };
}

/**
 * Memverifikasi keabsahan signature SHA-512 dari Midtrans Webhook:
 * SHA512(order_id + status_code + gross_amount + SERVER_KEY)
 * gross_amount harus berupa string apa adanya seperti yang dikirim Midtrans.
 */
function verifyWebhookSignature({ order_id, status_code, gross_amount, signature_key }) {
  const serverKey = env.MIDTRANS.SERVER_KEY;
  if (!order_id || !status_code || !gross_amount || !signature_key || !serverKey) {
    return false;
  }

  const rawString = `${order_id}${status_code}${gross_amount}${serverKey}`;
  const calculatedHash = crypto.createHash('sha512').update(rawString).digest('hex');

  const bufCalculated = Buffer.from(calculatedHash.toLowerCase());
  const bufSignature = Buffer.from(String(signature_key).toLowerCase());

  if (bufCalculated.length !== bufSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufCalculated, bufSignature);
}

module.exports = {
  createSnapTransaction,
  verifyWebhookSignature,
  setMockSnapClient,
};
