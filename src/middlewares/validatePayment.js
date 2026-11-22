/**
 * Middleware validasi input untuk POST /api/payments
 */
function validatePayment(req, res, next) {
  const { amount, items } = req.body;

  // 1. Validasi amount: wajib integer > 0
  if (amount === undefined || amount === null || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({
      error: 'Validasi gagal',
      message: 'amount wajib berupa bilangan bulat (integer) lebih besar dari 0.',
    });
  }

  // 2. Validasi items: wajib array tidak kosong
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Validasi gagal',
      message: 'items wajib berupa array yang berisi minimal satu item.',
    });
  }

  // 3. Validasi setiap item dan akumulasi total
  let calculatedTotal = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: `Item pada indeks ${i} tidak valid.`,
      });
    }

    const price = item.price;
    const quantity = item.quantity;

    if (price === undefined || typeof price !== 'number' || !Number.isInteger(price) || price < 0) {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: `Item "${item.name || i}" memiliki price yang tidak valid (wajib integer >= 0).`,
      });
    }

    if (quantity === undefined || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        error: 'Validasi gagal',
        message: `Item "${item.name || i}" memiliki quantity yang tidak valid (wajib integer > 0).`,
      });
    }

    calculatedTotal += price * quantity;
  }

  // 4. Total (price * quantity) HARUS sama persis dengan amount
  if (calculatedTotal !== amount) {
    return res.status(400).json({
      error: 'Validasi gagal',
      message: `Total perhitungan items (${calculatedTotal}) tidak sesuai dengan amount (${amount}).`,
    });
  }

  next();
}

module.exports = validatePayment;
