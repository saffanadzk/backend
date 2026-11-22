const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const validatePayment = require('../middlewares/validatePayment');

// 1. Buat pembayaran Midtrans Snap
router.post('/payments', validatePayment, paymentController.create);

// 2. Webhook notifikasi Midtrans (tanpa autentikasi, verifikasi signature dilakukan di service)
router.post('/payments/notification', paymentController.notification);

// 3. Detail dan status pembayaran
router.get('/payments/:orderId', paymentController.getDetail);

module.exports = router;
