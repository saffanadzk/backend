const env = require('../config/env');

/**
 * Middleware autentikasi API Key internal untuk melindungi endpoint POST /api/payments.
 * Membandingkan header `x-api-key` dengan `INTERNAL_API_KEY` dari environment.
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = env.INTERNAL_API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'INTERNAL_API_KEY belum dikonfigurasi pada server.',
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Akses ditolak: API Key tidak valid atau header x-api-key tidak disertakan.',
    });
  }

  next();
}

module.exports = apiKeyAuth;
