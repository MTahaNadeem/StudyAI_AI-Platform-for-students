// Run this ONCE to create the admin account:
// node seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Delete existing admin
  await User.deleteOne({ email: 'admin@studyai.com' });

  const admin = await User.create({
    name:       'Admin',
    email:      'admin@studyai.com',
    password:   'admin123',
    university: 'StudyAI Platform',
    role:       'admin'
  });

  console.log('✅ Admin created:', admin.email, '/ password: admin123');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
