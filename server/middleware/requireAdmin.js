const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ error: 'Admin auth required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.admin) return res.status(401).json({ error: 'Not an admin session' });
    const user = getDb().prepare("SELECT id, email FROM users WHERE id = ? AND type = 'admin' AND active = 1").get(payload.uid);
    if (!user) return res.status(403).json({ error: 'Admin user not found' });
    req.admin = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid admin session' });
  }
}

module.exports = { requireAdmin };
