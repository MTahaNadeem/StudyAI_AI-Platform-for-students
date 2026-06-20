const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  subject:     { type: String, required: true },
  description: { type: String, required: true },
  dueDate:     { type: Date },
  status:      { type: String, enum: ['pending', 'submitted', 'graded'], default: 'pending' },

  // Student submission
  submission:  { type: String, default: '' },
  submittedAt: { type: Date },

  // AI grading & feedback
  aiGrade:     { type: Number, default: null },   // 0-100
  aiFeedback:  { type: String, default: '' },
  aiStrengths: { type: [String], default: [] },
  aiWeaknesses:{ type: [String], default: [] }

}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
