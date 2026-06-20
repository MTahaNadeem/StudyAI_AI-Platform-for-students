const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, minlength: 6, select: false },
  university: { type: String, default: '' },
  role:       { type: String, enum: ['student', 'admin'], default: 'student' },
  avatar:     { type: String, default: '' },

  // Live monitoring stats
  stats: {
    totalMessages:    { type: Number, default: 0 },
    totalQuizzes:     { type: Number, default: 0 },
    totalCorrect:     { type: Number, default: 0 },
    totalAssignments: { type: Number, default: 0 },
    topicsStudied:    { type: [String], default: [] },
    lastActive:       { type: Date, default: Date.now },
    weeklyActivity:   { type: [Number], default: [0,0,0,0,0,0,0] } // Sun-Sat
  },

  // Topic performance breakdown
  topicScores: [{
    topic:   String,
    correct: { type: Number, default: 0 },
    total:   { type: Number, default: 0 }
  }]

}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(entered) {
  return bcrypt.compare(entered, this.password);
};

// Computed accuracy
userSchema.virtual('accuracy').get(function() {
  const t = this.stats.totalQuizzes * 5;
  return t > 0 ? Math.round((this.stats.totalCorrect / t) * 100) : 0;
});

module.exports = mongoose.model('User', userSchema);
