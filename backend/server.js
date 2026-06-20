require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const app = express();

// Allow frontend requests
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

// ── Security middleware ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many AI requests. Please wait a moment.' } });
app.use('/api/', limiter);
app.use('/api/chat', aiLimiter);
app.use('/api/quiz/generate', aiLimiter);

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/chat',       require('./routes/chat'));
app.use('/api/quiz',       require('./routes/quiz'));
app.use('/api/assignment', require('./routes/assignment'));
app.use('/api/admin',      require('./routes/admin'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Error handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Connect DB & start server ────────────────────────────────────
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/studyai';

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
