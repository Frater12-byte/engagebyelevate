/**
 * Engage by Elevate - main server
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { getDb } = require('./db/connection');
const meetingsService = require('./services/meetings');

const app = express();

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
