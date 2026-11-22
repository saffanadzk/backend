const UserModel = require('./models/userModel');

/**
 * Middleware autentikasi demo untuk memverifikasi user pembeli tiruan.
 * Mendukung header:
 * - Authorization: Bearer <username/token>
 * - x-user-id: <id>
 * - x-user-username: <username>
 */
function requireAuth(req, res, next) {
  let user = null;

  const authHeader = req.headers['authorization'];
  const userIdHeader = req.headers['x-user-id'];
  const userUsernameHeader = req.headers['x-user-username'];

  if (userIdHeader) {
    user = UserModel.findById(parseInt(userIdHeader, 10));
  } else if (userUsernameHeader) {
    user = UserModel.findByUsername(userUsernameHeader);
    // Auto-provision demo user jika belum ada di database
    if (!user && (userUsernameHeader === 'pembeli_siti' || userUsernameHeader === 'user_lain')) {
      user = UserModel.create({
        username: userUsernameHeader,
        email: `${userUsernameHeader}@prelove.com`,
        firstName: userUsernameHeader === 'pembeli_siti' ? 'Siti' : 'User Lain',
        phone: '08123456789',
      });
    }
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    user = UserModel.findByUsername(token) || UserModel.findById(parseInt(token, 10));
    if (!user && (token === 'pembeli_siti' || token === 'user_lain')) {
      user = UserModel.create({
        username: token,
        email: `${token}@prelove.com`,
        firstName: token === 'pembeli_siti' ? 'Siti' : 'User Lain',
        phone: '08123456789',
      });
    }
  }

  if (!user) {
    return res.status(401).json({ detail: 'Autentikasi diperlukan.' });
  }

  req.user = user;
  next();
}

module.exports = {
  requireAuth,
};
