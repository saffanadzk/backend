const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const validatePayment = require('../middlewares/validatePayment');
const apiKeyAuth = require('../middlewares/apiKeyAuth');

// 1. Buat pembayaran Midtrans Snap (dilindungi API Key internal)
router.post('/payments', apiKeyAuth, validatePayment, paymentController.create);

// 2. Webhook notifikasi Midtrans (tanpa API key, dilindungi verifikasi signature SHA-512)
router.post('/payments/notification', paymentController.notification);

// 3. Detail dan status pembayaran (terbuka untuk pengecekan status)
router.get('/payments/:orderId', paymentController.getDetail);

module.exports = router;
