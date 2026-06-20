const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const sign = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const safeUser = u => ({
  id: u._id, name: u.name, email: u.email,
  university: u.university, role: u.role,
  stats: u.stats, topicScores: u.topicScores,
  createdAt: u.createdAt
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, university } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered.' });

    const user = await User.create({ name, email, password, university });
    res.status(201).json({ token: sign(user._id), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Incorrect email or password.' });

    res.json({ token: sign(user._id), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get profile
router.get('/me', protect, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// Update profile
router.put('/me', protect, async (req, res) => {
  try {
    const { name, university } = req.body;
    Object.assign(req.user, { name, university });
    await req.user.save();
    res.json({ user: safeUser(req.user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
