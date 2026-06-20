const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });

    const token   = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists.' });

    // Update last active
    user.stats.lastActive = new Date();
    const day = new Date().getDay();
    user.stats.weeklyActivity[day] = (user.stats.weeklyActivity[day] || 0) + 1;
    await user.save({ validateBeforeSave: false });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required.' });
  next();
};

module.exports = { protect, adminOnly };
