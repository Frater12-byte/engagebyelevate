const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');
const { emailVerifiedOrInGrace } = require('./verifyEmail');

function requireAuth(req, res, next) {
  const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = getDb().prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!emailVerifiedOrInGrace(user)) {
      res.clearCookie('session');
      res.clearCookie('logged_in');
      return res.status(401).json({ error: 'Email verification required. Please check your inbox for the sign-in link or request a new one.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
