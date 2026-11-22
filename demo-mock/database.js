const path = require('path');
const Database = require('better-sqlite3');

let dbInstance = null;
const defaultDbPath = path.resolve(__dirname, 'demo.db');

function getDatabase(dbPath = defaultDbPath) {
  if (dbInstance) {
    return dbInstance;
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);

  dbInstance = db;
  return dbInstance;
}

function initSchema(db) {
  // 1. Model User (Placeholder Tim Auth)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT,
      phone TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Model Product (Placeholder Tim Produk)
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      seller_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Model Order: SEMENTARA (Placeholder Tim Order)
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      gross_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      snap_token TEXT,
      redirect_url TEXT,
      payment_type TEXT,
      transaction_id TEXT,
      paid_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase,
};
