const express = require('express');
const router = express.Router();
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const OrderModel = require('../models/orderModel');
const { requireAuth } = require('../middlewares/authMiddleware');

router.post('/auth/login', (req, res) => {
  const { username } = req.body;
  const user = UserModel.findByUsername(username);
  if (!user) {
    return res.status(401).json({ detail: 'User tidak ditemukan' });
  }
  return res.json({
    message: 'Login berhasil',
    user: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      email: user.email,
      phone: user.phone,
    },
  });
});

router.get('/products', (req, res) => {
  const products = ProductModel.findAll();
  return res.json(products);
});

router.get('/orders', requireAuth, (req, res) => {
  const db = require('../config/database').getDatabase();
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.buyer_id = ?
    ORDER BY o.id DESC
  `).all(req.user.id);
  return res.json(orders);
});

// Endpoint bantuan untuk membuat pesanan baru dari web demo
router.post('/orders/create-demo', requireAuth, (req, res) => {
  const { product_id } = req.body;
  let product = null;

  if (product_id) {
    product = ProductModel.findById(product_id);
  }

  // Fallback jika ID produk spesifik tidak ada: gunakan produk pertama yang tersedia
  if (!product) {
    const allProducts = ProductModel.findAll();
    if (allProducts && allProducts.length > 0) {
      product = allProducts[0];
    }
  }

  // Fallback darurat jika database produk benar-benar kosong
  if (!product) {
    product = ProductModel.create({
      name: 'Kamera Vintage Polaroid 600',
      price: 450000,
      status: 'AVAILABLE',
      sellerId: req.user.id,
    });
  }

  const orderId = `PRELOVE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const newOrder = OrderModel.create({
    orderId,
    buyerId: req.user.id,
    productId: product.id,
    grossAmount: product.price,
    status: 'PENDING',
  });

  return res.status(201).json(OrderModel.findByOrderId(newOrder.order_id));
});

module.exports = router;
