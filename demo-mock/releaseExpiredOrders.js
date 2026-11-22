const { closeDatabase } = require('./database');

async function run() {
  console.log('Script demo releaseExpiredOrders (placeholder).');
  closeDatabase();
}

if (require.main === module) {
  run();
}

module.exports = run;
