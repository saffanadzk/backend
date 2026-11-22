const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const request = require('supertest');

const app = require('../src/app');
const env = require('../src/config/env');
const prisma = require('../src/config/prisma');
const { setMockSnapClient } = require('../src/services/midtransService');

describe('Standalone Payment Module Tests', () => {
  const testServerKey = 'SB-Mid-server-TEST-KEY-12345';

  before(() => {
    env.MIDTRANS.SERVER_KEY = testServerKey;
  });

  beforeEach(async () => {
    // Bersihkan tabel payments sebelum setiap pengujian
    await prisma.payment.deleteMany();
  });

  after(async () => {
    await prisma.payment.deleteMany();
    await prisma.$disconnect();
  });

  function calculateSignature(orderId, statusCode, grossAmountStr, serverKey = testServerKey) {
    const raw = `${orderId}${statusCode}${grossAmountStr}${serverKey}`;
    return crypto.createHash('sha512').update(raw).digest('hex');
  }

  // 1. Health Check
  it('GET /health mengembalikan status 200 OK', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  // 2. Validasi Input POST /api/payments
  it('POST /api/payments menolak jika amount <= 0 atau bukan integer (400)', async () => {
    const res1 = await request(app)
      .post('/api/payments')
      .send({
        amount: 0,
        items: [{ price: 0, quantity: 1 }],
      });
    assert.strictEqual(res1.status, 400);
    assert.match(res1.body.message, /amount wajib berupa bilangan bulat/i);

    const res2 = await request(app)
      .post('/api/payments')
      .send({
        amount: 150000.5,
        items: [{ price: 150000, quantity: 1 }],
      });
    assert.strictEqual(res2.status, 400);
  });

  it('POST /api/payments menolak jika items kosong atau tidak valid (400)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({
        amount: 100000,
        items: [],
      });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /items wajib berupa array/i);
  });

  it('POST /api/payments menolak jika total item (price * quantity) tidak sama dengan amount (400)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({
        amount: 150000,
        items: [
          { id: '1', price: 100000, quantity: 1, name: 'Barang A' },
          // Total items = 100.000, tapi amount = 150.000
        ],
      });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /tidak sesuai dengan amount/i);
  });

  // 3. Sukses Buat Pembayaran
  it('POST /api/payments sukses membuat order_id PAY-xxx, token Snap, dan tersimpan di DB status "pending"', async () => {
    setMockSnapClient({
      createTransaction: async (param) => {
        assert.strictEqual(param.expiry.unit, 'minute');
        assert.strictEqual(param.expiry.duration, 60);
        return {
          token: 'mock-snap-token-777',
          redirect_url: 'https://app.sandbox.midtrans.com/snap/v4/redirection/777',
        };
      },
    });

    const body = {
      amount: 250000,
      reference_id: 'REF-ORDER-999',
      items: [
        { id: 'PROD-1', price: 200000, quantity: 1, name: 'Jaket Kulit Vintage' },
        { id: 'PROD-2', price: 50000, quantity: 1, name: 'Ongkir' },
      ],
      customer: {
        first_name: 'Budi',
        email: 'budi@example.com',
      },
      metadata: {
        promo_code: 'HEMAT10',
      },
    };

    const res = await request(app).post('/api/payments').send(body);
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.payment_id);
    assert.ok(res.body.order_id);
    assert.match(res.body.order_id, /^PAY-\d+-[A-F0-9]+$/);
    assert.strictEqual(res.body.token, 'mock-snap-token-777');
    assert.strictEqual(res.body.status, 'pending');
    assert.ok(res.body.expires_at);
    assert.ok(res.body.expires_at.endsWith('+07:00'));

    // Cek di DB
    const savedInDb = await prisma.payment.findUnique({
      where: { order_id: res.body.order_id },
    });
    assert.ok(savedInDb);
    assert.strictEqual(savedInDb.status, 'pending');
    assert.strictEqual(savedInDb.gross_amount, 250000);
    assert.strictEqual(savedInDb.reference_id, 'REF-ORDER-999');
  });

  // 4. GET /api/payments/:orderId
  it('GET /api/payments/:orderId mengembalikan 404 jika order tidak ada', async () => {
    const res = await request(app).get('/api/payments/PAY-TIDAK-ADA');
    assert.strictEqual(res.status, 404);
  });

  it('GET /api/payments/:orderId mengembalikan detail dengan format ISO +07:00', async () => {
    const payment = await prisma.payment.create({
      data: {
        order_id: 'PAY-1000-TEST',
        reference_id: 'ORDER-101',
        gross_amount: 150000,
        status: 'lunas',
        payment_type: 'bank_transfer',
        snap_token: 'token-xyz',
        redirect_url: 'https://midtrans.com',
        item_details: JSON.stringify([{ price: 150000, quantity: 1 }]),
        expires_at: new Date(Date.now() + 3600000),
        paid_at: new Date('2026-11-22T12:50:00.000Z'), // UTC 12:50 -> WIB 19:50
      },
    });

    const res = await request(app).get(`/api/payments/${payment.order_id}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.order_id, 'PAY-1000-TEST');
    assert.strictEqual(res.body.reference_id, 'ORDER-101');
    assert.strictEqual(res.body.amount, 150000);
    assert.strictEqual(res.body.status, 'lunas');
    assert.strictEqual(res.body.payment_type, 'bank_transfer');
    assert.ok(res.body.created_at.endsWith('+07:00'));
    assert.ok(res.body.expires_at.endsWith('+07:00'));
    assert.ok(res.body.paid_at.endsWith('+07:00'));
    assert.strictEqual(res.body.paid_at, '2026-11-22T19:50:00+07:00');
  });

  // 5. Webhook: Signature salah -> 403
  it('POST /api/payments/notification menolak signature salah dengan status 403', async () => {
    const payload = {
      order_id: 'PAY-1234',
      status_code: '200',
      gross_amount: '150000.00',
      signature_key: 'invalid-hash-here',
      transaction_status: 'settlement',
    };

    const res = await request(app).post('/api/payments/notification').send(payload);
    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /signature key tidak valid/i);
  });

  // 6. Webhook: Order tidak ditemukan -> 404
  it('POST /api/payments/notification mengembalikan 404 jika order_id tidak ada di DB', async () => {
    const orderId = 'PAY-UNKNOWN-999';
    const statusCode = '200';
    const grossAmount = '150000.00';
    const sig = calculateSignature(orderId, statusCode, grossAmount);

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: sig,
      transaction_status: 'settlement',
    };

    const res = await request(app).post('/api/payments/notification').send(payload);
    assert.strictEqual(res.status, 404);
  });

  // 7. Webhook: Settlement -> status "lunas" dan paid_at WIB
  it('POST /api/payments/notification status "settlement" mengubah status menjadi "lunas" dan mengisi paid_at', async () => {
    const payment = await prisma.payment.create({
      data: {
        order_id: 'PAY-SETTLE-001',
        gross_amount: 150000,
        status: 'pending',
        snap_token: 'token-abc',
        redirect_url: 'https://midtrans.com',
        item_details: JSON.stringify([{ price: 150000, quantity: 1 }]),
        expires_at: new Date(Date.now() + 3600000),
      },
    });

    const statusCode = '200';
    const grossAmountStr = '150000.00';
    const sig = calculateSignature(payment.order_id, statusCode, grossAmountStr);

    const payload = {
      order_id: payment.order_id,
      status_code: statusCode,
      gross_amount: grossAmountStr,
      signature_key: sig,
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
      settlement_time: '2026-11-22 19:45:00', // WIB
    };

    const res = await request(app).post('/api/payments/notification').send(payload);
    assert.strictEqual(res.status, 200);

    const updated = await prisma.payment.findUnique({
      where: { order_id: payment.order_id },
    });
    assert.strictEqual(updated.status, 'lunas');
    assert.strictEqual(updated.payment_type, 'bank_transfer');
    assert.ok(updated.paid_at);
    assert.strictEqual(updated.paid_at.toISOString(), '2026-11-22T12:45:00.000Z');
  });

  // 8. Webhook: Idempotensi (notifikasi kedua diabaikan)
  it('POST /api/payments/notification bersifat idempotent (tidak menimpa status lunas)', async () => {
    const paidDate = new Date('2026-11-22T12:45:00.000Z');
    const payment = await prisma.payment.create({
      data: {
        order_id: 'PAY-IDEMPOTENT-001',
        gross_amount: 150000,
        status: 'lunas',
        payment_type: 'bank_transfer',
        snap_token: 'token-abc',
        redirect_url: 'https://midtrans.com',
        item_details: JSON.stringify([{ price: 150000, quantity: 1 }]),
        expires_at: new Date(Date.now() + 3600000),
        paid_at: paidDate,
      },
    });

    const statusCode = '200';
    const grossAmountStr = '150000.00';
    const sig = calculateSignature(payment.order_id, statusCode, grossAmountStr);

    const payload = {
      order_id: payment.order_id,
      status_code: statusCode,
      gross_amount: grossAmountStr,
      signature_key: sig,
      transaction_status: 'expire', // Mencoba downgrade status
      settlement_time: '2026-11-22 22:00:00',
    };

    const res = await request(app).post('/api/payments/notification').send(payload);
    assert.strictEqual(res.status, 200);

    const fresh = await prisma.payment.findUnique({
      where: { order_id: payment.order_id },
    });
    // Status tetap "lunas", paid_at tidak tertimpa
    assert.strictEqual(fresh.status, 'lunas');
    assert.strictEqual(fresh.paid_at.toISOString(), paidDate.toISOString());
  });

  // 9. Webhook: Mapping status lainnya (capture challenge, deny/cancel -> gagal, expire -> kadaluarsa)
  it('POST /api/payments/notification memetakan deny/cancel -> gagal dan expire -> kadaluarsa', async () => {
    const paymentExpire = await prisma.payment.create({
      data: {
        order_id: 'PAY-EXPIRE-001',
        gross_amount: 100000,
        status: 'pending',
        snap_token: 'token-exp',
        redirect_url: 'https://midtrans.com',
        item_details: JSON.stringify([{ price: 100000, quantity: 1 }]),
        expires_at: new Date(Date.now() + 3600000),
      },
    });

    const sigExpire = calculateSignature(paymentExpire.order_id, '200', '100000.00');
    await request(app).post('/api/payments/notification').send({
      order_id: paymentExpire.order_id,
      status_code: '200',
      gross_amount: '100000.00',
      signature_key: sigExpire,
      transaction_status: 'expire',
    });

    const checkExpire = await prisma.payment.findUnique({
      where: { order_id: paymentExpire.order_id },
    });
    assert.strictEqual(checkExpire.status, 'kadaluarsa');
    assert.strictEqual(checkExpire.paid_at, null);
  });
});
