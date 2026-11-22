const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/paymentRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing API Payments Standalone
app.use('/api', paymentRoutes);

// Endpoint Health Check (terbuka)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Prelove Payment Service is running',
    timestamp: new Date().toISOString(),
  });
});

// Demo / Mock Routes (HANYA dimuat jika ENABLE_DEMO=true di .env, default nonaktif)
if (process.env.ENABLE_DEMO === 'true') {
  try {
    const demoRoutes = require('../demo-mock/mockRoutes');
    app.use('/api/demo', demoRoutes);
    console.log('[Demo] Mock routes aktif di /api/demo');
  } catch (err) {
    console.warn('[Demo] Gagal memuat demo routes:', err.message);
  }
}

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Rute "${req.method} ${req.originalUrl}" tidak ditemukan.`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
