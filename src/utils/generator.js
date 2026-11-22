const crypto = require('crypto');

/**
 * Generate order_id unik untuk Midtrans dengan format:
 * PAY-<timestamp>-<random hex> (maksimal 50 karakter)
 * Contoh: PAY-1732280000-A1B2C3D4 (23 karakter)
 */
function generateOrderId() {
  const timestamp = Math.floor(Date.now() / 1000);
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PAY-${timestamp}-${randomHex}`;
}

module.exports = {
  generateOrderId,
};
