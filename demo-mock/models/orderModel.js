const { getDatabase } = require('../database');

const OrderModel = {
  findByOrderId(orderId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT o.*, p.name as product_name, p.price as product_price,
             u.username as buyer_username, u.email as buyer_email
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.buyer_id = u.id
      WHERE o.order_id = ?
    `).get(orderId);
  },

  create({ orderId, buyerId, productId, grossAmount, status = 'PENDING' }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO orders (order_id, buyer_id, product_id, gross_amount, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(orderId, buyerId, productId, grossAmount, status);
    return this.findByOrderId(orderId);
  },
};

module.exports = OrderModel;
