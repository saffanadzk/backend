const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Prelove Standalone Payment Server running!`);
  console.log(` Port: ${PORT}`);
  console.log(` Environment: ${env.MIDTRANS.IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX'}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(` Payment API : http://localhost:${PORT}/api/payments`);
  console.log(` Webhook URL : http://localhost:${PORT}/api/payments/notification`);
  console.log(`====================================================`);
});

// Penanganan Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\nMematikan server payment...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Koneksi Prisma database ditutup.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

module.exports = server;
