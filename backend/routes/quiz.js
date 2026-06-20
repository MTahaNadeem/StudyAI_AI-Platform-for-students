const express = require('express');
const router  = express.Router();
const Groq = require('groq-sdk');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/quiz/generate
router.post('/generate', protect, async (req, res) => {
  try {
    const { topic, count = 5 } = req.body;
    if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required.' });

    const prompt = `Create exactly ${count} multiple-choice questions about "${topic}" for a university CS student.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
[
  {
    "question": "Clear question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0
  }
]
"answer" = index (0-3) of the CORRECT option.
Make questions progressively harder. Cover different aspects of the topic.`;

    const result = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a quiz generation assistant that returns only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    let raw = result.choices?.[0]?.message?.content?.trim() || '';
    raw = raw.replace(/```json|```/g, '').trim();

    // Find JSON array in response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI returned invalid format');
    const questions = JSON.parse(match[0]);

    const quiz = await Quiz.create({
      user: req.user._id,
      topic: topic.trim(),
      questions,
      total: questions.length
    });

    res.json({ quiz });
  } catch (e) {
    console.error('Quiz gen error:', e.message);
    res.status(500).json({ error: 'Failed to generate quiz. Try a more specific topic.' });
  }
});

// POST /api/quiz/:id/submit
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    const quiz = await Quiz.findOne({ _id: req.params.id, user: req.user._id });
    if (!quiz)          return res.status(404).json({ error: 'Quiz not found.' });
    if (quiz.completed) return res.status(400).json({ error: 'Quiz already submitted.' });

    let correct = 0;
    const results = quiz.questions.map((q, i) => {
      const isCorrect = answers[i] === q.answer;
      if (isCorrect) correct++;
      return {
        question:      q.question,
        options:       q.options,
        yourAnswer:    answers[i] ?? -1,
        correctAnswer: q.answer,
        isCorrect
      };
    });

    quiz.answers   = answers;
    quiz.score     = correct;
    quiz.completed = true;
    quiz.timeTaken = timeTaken || 0;
    await quiz.save();

    // Update user stats + topic breakdown
    const user = await User.findById(req.user._id);
    user.stats.totalQuizzes  += 1;
    user.stats.totalCorrect  += correct;

    const topicEntry = user.topicScores.find(t => t.topic === quiz.topic);
    if (topicEntry) {
      topicEntry.correct += correct;
      topicEntry.total   += quiz.total;
    } else {
      user.topicScores.push({ topic: quiz.topic, correct, total: quiz.total });
    }
    await user.save();

    res.json({
      score:   correct,
      total:   quiz.total,
      percent: Math.round((correct / quiz.total) * 100),
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/quiz/my — Student's quiz history
router.get('/my', protect, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ user: req.user._id, completed: true })
      .sort({ createdAt: -1 }).limit(50)
      .select('topic score total timeTaken createdAt');
    res.json({ quizzes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/quiz/:id — Single quiz detail
router.get('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, user: req.user._id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    res.json({ quiz });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
