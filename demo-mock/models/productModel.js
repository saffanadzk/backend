const { getDatabase } = require('../database');

const ProductModel = {
  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  findAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  },

  create({ name, price, status = 'AVAILABLE', sellerId }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO products (name, price, status, seller_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(name, price, status, sellerId);
    return this.findById(info.lastInsertRowid);
  },
};

module.exports = ProductModel;
