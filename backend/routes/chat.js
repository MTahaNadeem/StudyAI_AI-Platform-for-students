const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM = `You are StudyAI Tutor, an expert academic assistant for university students.

Your capabilities:
- Answer questions on ALL academic subjects: CS (OOP, DBMS, Web Engineering, Networking, OS, Algorithms, Data Structures, Software Engineering), Math, Physics, and more
- Explain complex concepts with simple language, real-world examples, analogies
- Help with programming (Python, Java, C++, JavaScript, etc.) — explain code line by line
- Assist with assignment understanding (do NOT write assignments for students, guide them)
- Generate study plans and revision tips
- Identify a student's weak areas and suggest improvements

Response format:
- Use clear headings and bullet points
- Keep answers thorough but concise
- Add examples whenever helpful
- End with "💡 Quick Tip:" for important exam points

Always respond in English. Be encouraging and supportive.`;

function detectTopic(msg) {
  const m = msg.toLowerCase();
  if (m.includes('oop') || m.includes('class') || m.includes('inherit')) return 'OOP';
  if (m.includes('sql') || m.includes('database') || m.includes('query')) return 'DBMS';
  if (m.includes('http') || m.includes('web') || m.includes('html')) return 'Web Engineering';
  if (m.includes('network') || m.includes('tcp') || m.includes('ip')) return 'Networks';
  if (m.includes('operating') || m.includes('process') || m.includes('thread')) return 'OS';
  if (m.includes('algorithm') || m.includes('sort') || m.includes('search')) return 'Algorithms';
  if (m.includes('array') || m.includes('tree') || m.includes('linked')) return 'Data Structures';
  if (m.includes('python') || m.includes('java') || m.includes('code')) return 'Programming';
  return 'General';
}

router.post('/ask', protect, async (req, res) => {
  try {
    const { message, chatId } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    let chat = null;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, user: req.user._id });
    }
    if (!chat) {
      chat = new Chat({
        user: req.user._id,
        title: message.slice(0, 60),
        topic: detectTopic(message),
      });
    }

    const messages = [
      { role: 'system', content: SYSTEM },
      ...(chat.messages || []).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const result = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const aiReply = result.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response at this time.';

    chat.messages.push({ role: 'user', content: message });
    chat.messages.push({ role: 'model', content: aiReply });
    await chat.save();

    const topic = detectTopic(message);
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalMessages': 1 },
      $addToSet: { 'stats.topicsStudied': topic },
    });

    res.json({ reply: aiReply, chatId: chat._id, topic });
  } catch (error) {
    console.error('Groq API error:', error);
    const message = error?.response?.data?.error || error?.message || 'AI service request failed.'
    res.status(500).json({ error: `AI service error: ${message}` });
  }
});

// GET /api/chat/history — All chats for current user
router.get('/history', protect, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user._id })
      .sort({ updatedAt: -1 }).limit(30)
      .select('title topic updatedAt messages');
    res.json({ chats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/chat/:id — Single chat with all messages
router.get('/:id', protect, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat not found.' });
    res.json({ chat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/chat/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Chat.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Chat deleted.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
