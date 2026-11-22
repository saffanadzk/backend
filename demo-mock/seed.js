const { getDatabase } = require('./database');
const UserModel = require('./models/userModel');
const ProductModel = require('./models/productModel');
const OrderModel = require('./models/orderModel');

function seed() {
  const db = getDatabase();
  console.log('Menjalankan seed database demo...');

  // 1. Users
  let seller = UserModel.findByUsername('penjual_budi');
  if (!seller) {
    seller = UserModel.create({
      username: 'penjual_budi',
      email: 'budi@prelove.com',
      firstName: 'Budi',
      phone: '08123456780',
    });
  }

  let buyer = UserModel.findByUsername('pembeli_siti');
  if (!buyer) {
    buyer = UserModel.create({
      username: 'pembeli_siti',
      email: 'siti@prelove.com',
      firstName: 'Siti',
      phone: '08123456789',
    });
  }

  let otherUser = UserModel.findByUsername('user_lain');
  if (!otherUser) {
    otherUser = UserModel.create({
      username: 'user_lain',
      email: 'joko@prelove.com',
      firstName: 'Joko',
      phone: '08123456799',
    });
  }

  // 2. Products
  let prod1 = db.prepare('SELECT * FROM products WHERE name = ?').get('Kamera Vintage Polaroid 600');
  if (!prod1) {
    prod1 = ProductModel.create({
      name: 'Kamera Vintage Polaroid 600',
      price: 450000,
      status: 'AVAILABLE',
      sellerId: seller.id,
    });
  }

  let prod2 = db.prepare('SELECT * FROM products WHERE name = ?').get('Jaket Kulit Secondhand Vintage Size L');
  if (!prod2) {
    prod2 = ProductModel.create({
      name: 'Jaket Kulit Secondhand Vintage Size L',
      price: 250000,
      status: 'AVAILABLE',
      sellerId: seller.id,
    });
  }

  // 3. Sample Order
  let sampleOrder = OrderModel.findByOrderId('PRELOVE-DEMO-001');
  if (!sampleOrder) {
    sampleOrder = OrderModel.create({
      orderId: 'PRELOVE-DEMO-001',
      buyerId: buyer.id,
      productId: prod1.id,
      grossAmount: prod1.price,
      status: 'PENDING',
    });
  }

  console.log('Seed demo berhasil!');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
