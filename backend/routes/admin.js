const express = require('express');
const router  = express.Router();
const User       = require('../models/User');
const Quiz       = require('../models/Quiz');
const Chat       = require('../models/Chat');
const Assignment = require('../models/Assignment');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// GET /api/admin/students — All students with stats
router.get('/students', async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .sort({ createdAt: -1 })
      .select('-password');
    res.json({ students });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/students/:id — Single student full report
router.get('/students/:id', async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const [quizzes, chats, assignments] = await Promise.all([
      Quiz.find({ user: req.params.id, completed: true }).sort({ createdAt: -1 }).limit(20),
      Chat.find({ user: req.params.id }).sort({ updatedAt: -1 }).limit(10).select('title topic updatedAt'),
      Assignment.find({ user: req.params.id }).sort({ createdAt: -1 })
    ]);

    res.json({ student, quizzes, chats, assignments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/overview — Platform-wide stats
router.get('/overview', async (req, res) => {
  try {
    const [totalStudents, totalQuizzes, totalChats, totalAssignments] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Quiz.countDocuments({ completed: true }),
      Chat.countDocuments(),
      Assignment.countDocuments({ status: 'graded' })
    ]);

    // Top active students
    const topStudents = await User.find({ role: 'student' })
      .sort({ 'stats.totalMessages': -1 })
      .limit(5)
      .select('name email university stats');

    // Recent activity
    const recentQuizzes = await Quiz.find({ completed: true })
      .sort({ createdAt: -1 }).limit(10)
      .populate('user', 'name email');

    res.json({ totalStudents, totalQuizzes, totalChats, totalAssignments, topStudents, recentQuizzes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
