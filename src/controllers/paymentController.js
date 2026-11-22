const paymentService = require('../services/paymentService');

async function create(req, res, next) {
  try {
    const { amount, items, customer, reference_id, metadata } = req.body;
    const result = await paymentService.createPayment({
      amount,
      items,
      customer,
      reference_id,
      metadata,
    });
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function getDetail(req, res, next) {
  try {
    const { orderId } = req.params;
    const payment = await paymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Pembayaran dengan order_id "${orderId}" tidak ditemukan.`,
      });
    }

    return res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
}

async function notification(req, res, next) {
  try {
    await paymentService.handleWebhookNotification(req.body);
    // Balas 200 secepat mungkin ke Midtrans
    return res.status(200).json({
      status: 'ok',
      message: 'Notifikasi berhasil diproses',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getDetail,
  notification,
};
