const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: String,
  options:  [String],
  answer:   Number
});

const quizSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:     { type: String, required: true },
  questions: [questionSchema],
  answers:   [Number],     // student's submitted answers
  score:     { type: Number, default: 0 },
  total:     { type: Number, default: 5 },
  completed: { type: Boolean, default: false },
  timeTaken: { type: Number, default: 0 }  // seconds
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
