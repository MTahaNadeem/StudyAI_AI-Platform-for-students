const express = require('express');
const router  = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');
const Assignment = require('../models/Assignment');
const User       = require('../models/User');
const { protect } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function gradePdfAssignment(assignment, fileBuffer) {
  const parsed = await pdfParse(fileBuffer);
  const extractedText = (parsed.text || '').trim();
  if (!extractedText) {
    throw new Error('Unable to extract text from the uploaded PDF.');
  }

  const prompt = `You are an expert university professor grading a student assignment.

Assignment Title: ${assignment.title}
Subject: ${assignment.subject}
Description: ${assignment.description}

Student submission extracted from the uploaded PDF:
${extractedText}

Grade this submission on a scale of 0 to 100 and return ONLY valid JSON with no markdown, no explanation:
{
  "grade": 0,
  "feedback": "Concise feedback text explaining strengths and weaknesses.",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": "One to two actionable improvement suggestions."
}`;

  const result = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: 'You are a grading expert who responds with valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1000,
  });

  let raw = result.choices?.[0]?.message?.content?.trim() || '';
  raw = raw.replace(/```json|```/g, '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  const grading = match ? JSON.parse(match[0]) : JSON.parse(raw);

  assignment.status = 'graded';
  assignment.aiGrade = Number(grading.grade ?? grading.score ?? 0);
  assignment.aiFeedback = (grading.feedback || grading.suggestions || '').trim();
  assignment.aiStrengths = grading.strengths || [];
  assignment.aiWeaknesses = grading.weaknesses || [];
  assignment.submission = extractedText;
  assignment.submittedAt = new Date();
  await assignment.save();

  await User.findByIdAndUpdate(assignment.user, {
    $inc: { 'stats.totalAssignments': 1 }
  });

  return assignment;
}

// POST /api/assignment — Create new assignment and grade PDF uploads automatically
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    const { title, subject, description, dueDate } = req.body;
    const file = req.file;
    if (!title || !subject || (!description && !file)) {
      return res.status(400).json({ error: 'Title, subject, and either description or PDF file are required.' });
    }

    const assignment = await Assignment.create({
      user: req.user._id,
      title,
      subject,
      description: description || `Uploaded PDF file ${file?.originalname}`,
      dueDate
    });

    if (file) {
      const gradedAssignment = await gradePdfAssignment(assignment, file.buffer);
      return res.status(201).json({ assignment: gradedAssignment });
    }

    res.status(201).json({ assignment });
  } catch (e) {
    console.error('Assignment creation/grading error:', e);
    res.status(500).json({ error: e.message || 'Unable to create or grade assignment.' });
  }
});

// GET /api/assignment — My assignments
router.get('/', protect, async (req, res) => {
  try {
    const assignments = await Assignment.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ assignments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/assignment/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const a = await Assignment.findOne({ _id: req.params.id, user: req.user._id });
    if (!a) return res.status(404).json({ error: 'Assignment not found.' });
    res.json({ assignment: a });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/assignment/:id/submit — Submit answer + AI grades it
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { submission } = req.body;
    if (!submission?.trim())
      return res.status(400).json({ error: 'Submission cannot be empty.' });

    const a = await Assignment.findOne({ _id: req.params.id, user: req.user._id });
    if (!a) return res.status(404).json({ error: 'Assignment not found.' });

    a.submission  = submission;
    a.submittedAt = new Date();
    a.status      = 'submitted';
    await a.save();

    // AI grading
    const prompt = `You are an expert university professor grading a student assignment.

Assignment: "${a.title}"
Subject: ${a.subject}
Description: ${a.description}

Student's Answer:
${submission}

Grade this submission and return ONLY valid JSON (no markdown, no explanation):
{
  "grade": 85,
  "feedback": "Overall feedback paragraph here",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": "How to improve next time"
}
"grade" must be a number 0-100. Be fair and constructive.`;

    const result = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a grading expert who responds with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    let raw = result.choices?.[0]?.message?.content?.trim() || '';
    raw = raw.replace(/```json|```/g, '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const grading = match ? JSON.parse(match[0]) : JSON.parse(raw);

    a.aiGrade      = grading.grade;
    a.aiFeedback   = grading.feedback + '\n\n💡 Suggestions: ' + grading.suggestions;
    a.aiStrengths  = grading.strengths || [];
    a.aiWeaknesses = grading.weaknesses || [];
    a.status       = 'graded';
    await a.save();

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalAssignments': 1 }
    });

    res.json({ assignment: a, grade: grading });
  } catch (e) {
    console.error('Grading error:', e.message);
    res.status(500).json({ error: 'AI grading failed. Submission saved, try grading later.' });
  }
});

// DELETE /api/assignment/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Assignment.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Assignment deleted.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
