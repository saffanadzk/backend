/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan internal pada server';

  // Log error di server
  if (statusCode >= 500) {
    console.error('[SERVER ERROR]', err);
  } else {
    console.warn(`[CLIENT ERROR ${statusCode}]`, message);
  }

  res.status(statusCode).json({
    error: err.name || 'Error',
    message: message,
  });
}

module.exports = errorHandler;
