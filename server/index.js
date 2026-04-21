/**
 * Engage by Elevate - main server
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const { getDb } = require('./db/connection');
const meetingsService = require('./services/meetings');

// Logo upload config
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

const app = express();
app.set('trust proxy', 1);

// Security + parsing
app.use(helmet({
  contentSecurityPolicy: false, // relax for inline scripts in static pages; tighten for prod
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting for sensitive endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true });
app.use('/auth', authLimiter);

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api', apiLimiter);

// File upload endpoints (before route mounting — multer needs direct access)
function authFromCookie(req) {
  const token = req.cookies?.session;
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
}

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  const payload = authFromCookie(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.file) return res.status(400).json({ error: 'No valid image file provided (max 2MB, PNG/JPG/SVG/WebP)' });
  const logoUrl = `/uploads/${req.file.filename}`;
  getDb().prepare('UPDATE users SET logo_url = ?, updated_at = datetime("now") WHERE id = ?').run(logoUrl, payload.uid);
  res.json({ ok: true, logo_url: logoUrl });
});

app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
  const payload = authFromCookie(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.file) return res.status(400).json({ error: 'No valid image file provided (max 2MB, PNG/JPG/SVG/WebP)' });
  const photoUrl = `/uploads/${req.file.filename}`;
  getDb().prepare('UPDATE users SET photo_url = ?, updated_at = datetime("now") WHERE id = ?').run(photoUrl, payload.uid);
  res.json({ ok: true, photo_url: photoUrl });
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/n8n', require('./routes/n8n'));
app.use('/api', require('./routes/meetings'));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Clean URL routes - serve HTML pages without .html
app.get(['/dashboard', '/directory', '/agenda'], (req, res) => {
  const page = req.path.slice(1) + '.html';
  res.sendFile(path.join(__dirname, '..', 'public', page));
});

// Health check
app.get('/health', (req, res) => {
  try { getDb().prepare('SELECT 1').get(); res.json({ status: 'ok' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize DB on boot
getDb();

// Expire stale pending meetings every 10 minutes
setInterval(() => {
  try {
    const n = meetingsService.expireStalePending();
    if (n > 0) console.log(`Expired ${n} stale pending meetings`);
  } catch (e) { console.error('expireStalePending error:', e.message); }
}, 10 * 60 * 1000);

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Engage by Elevate running on port ${PORT}`);
});
