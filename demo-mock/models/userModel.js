const { getDatabase } = require('../database');

const UserModel = {
  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  findByUsername(username) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  create({ username, email, firstName = '', phone = '', password = '' }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (username, email, first_name, phone, password)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(username, email, firstName, phone, password);
    return this.findById(info.lastInsertRowid);
  },
};

module.exports = UserModel;
