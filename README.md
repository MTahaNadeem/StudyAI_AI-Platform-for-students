# 🧠 StudyAI — Full Stack AI Study Platform

**Tech Stack:** Node.js + Express + MongoDB Atlas + Google Gemini AI

---

## 📁 Project Structure

```
studyai/
├── backend/
│   ├── models/
│   │   ├── User.js          ← Student accounts + stats
│   │   ├── Chat.js          ← AI conversation history
│   │   ├── Quiz.js          ← Quiz questions + results
│   │   └── Assignment.js    ← Assignments + AI grades
│   ├── routes/
│   │   ├── auth.js          ← Register, Login, Profile
│   │   ├── chat.js          ← AI Tutor (Gemini)
│   │   ├── quiz.js          ← Quiz Generator + Grader
│   │   ├── assignment.js    ← Assignment + AI Feedback
│   │   └── admin.js         ← Student Monitoring
│   ├── middleware/
│   │   └── auth.js          ← JWT authentication
│   ├── server.js            ← Main Express server
│   ├── seed.js              ← Create admin account
│   └── .env.example         ← Environment variables
└── frontend/
    └── index.html           ← Complete frontend (single file)
```

---

## ⚙️ Setup Instructions

### Step 1 — Get Your Free API Keys

**MongoDB Atlas (Free Database):**
1. Go to https://cloud.mongodb.com
2. Create free account → Create free cluster
3. Click "Connect" → "Drivers" → Copy connection string
4. Replace `<password>` with your DB password

**Google Gemini API (Free AI):**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

---

### Step 2 — Setup Backend

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env with your keys:
# MONGO_URI = your MongoDB connection string
# GEMINI_API_KEY = your Gemini API key
# JWT_SECRET = any long random string

# Install dependencies
npm install

# Create admin account (run ONCE)
node seed.js

# Start server
npm run dev
```

Server runs at: **http://localhost:5000**

---

### Step 3 — Open Frontend

Just open `frontend/index.html` in your browser.

OR serve with any static server:
```bash
npx serve frontend
```

---

## 🔑 Default Login (Admin)

```
Email:    admin@studyai.com
Password: admin123
```

Admins can see all students, their quiz scores, assignment grades, and activity.

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create student account |
| POST | /api/auth/login | Login |
| GET  | /api/auth/me | Get my profile |
| PUT  | /api/auth/me | Update profile |

### AI Tutor
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/chat/ask | Send message, get AI reply |
| GET  | /api/chat/history | All my chats |
| GET  | /api/chat/:id | Single chat |
| DELETE | /api/chat/:id | Delete chat |

### Quiz
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/quiz/generate | Generate 5 MCQs |
| POST | /api/quiz/:id/submit | Submit answers, get score |
| GET  | /api/quiz/my | My quiz history |

### Assignments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/assignment | Create assignment |
| GET  | /api/assignment | My assignments |
| POST | /api/assignment/:id/submit | Submit + AI grades |
| DELETE | /api/assignment/:id | Delete |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/overview | Platform stats |
| GET | /api/admin/students | All students |
| GET | /api/admin/students/:id | Student full report |

---

## ✨ Features

- ✅ **JWT Authentication** — Secure login/register
- ✅ **AI Tutor** — Google Gemini with full conversation history saved to MongoDB
- ✅ **Quiz Generator** — AI creates MCQs, auto-graded, stored in DB
- ✅ **Assignment Grader** — AI gives 0-100 grade + detailed feedback
- ✅ **Progress Tracking** — Topic-wise performance analytics
- ✅ **Admin Dashboard** — Monitor all students' activity
- ✅ **Rate Limiting** — Prevents API abuse
- ✅ **Security** — Helmet.js, bcrypt passwords, JWT tokens
