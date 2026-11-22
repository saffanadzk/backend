const { releaseExpiredOrders } = require('../services/paymentService');
const { closeDatabase } = require('../config/database');

async function run() {
  console.log('Menjalankan pengecekan pesanan kadaluarsa...');
  try {
    const { releasedCount, paidCount } = await releaseExpiredOrders();
    console.log(`Selesai: ${releasedCount} pesanan di-expire, ${paidCount} pesanan diperbarui menjadi lunas.`);
  } catch (err) {
    console.error('Error menjalankan releaseExpiredOrders:', err);
  } finally {
    closeDatabase();
  }
}

if (require.main === module) {
  run();
}

module.exports = run;
