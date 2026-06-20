import { useEffect, useState } from 'react'
import api, { setAuthToken } from './api'
import './App.css'

const initialMessages = [
  {
    role: 'ai',
    text: "👋 Hi! I'm your AI Study Tutor powered by Google Gemini.\n\nI can help you with any subject — OOP, DBMS, Web Engineering, Algorithms, Data Structures, Networks, OS, Math, Physics, and more.\n\nWhat would you like to learn today?"
  }
]

const quickPrompts = [
  'Explain HTTP vs HTTPS with examples',
  'What are the 4 pillars of OOP?',
  'Explain SQL JOINs with examples',
  'What is a deadlock in OS and how to prevent it?',
  'Explain Big O notation with examples'
]

function App() {
  const [page, setPage] = useState('home')
  const [section, setSection] = useState('dashboard')
  const [authMode, setAuthMode] = useState('login')
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setTokenState] = useState(() => localStorage.getItem('token') || '')
  const [toast, setToast] = useState({ message: '', type: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', university: '', password: '' })
  const [chatMessages, setChatMessages] = useState(initialMessages)
  const [chatHistory, setChatHistory] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [quizTopic, setQuizTopic] = useState('')
  const [quizError, setQuizError] = useState('')
  const [quizLoading, setQuizLoading] = useState(false)
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizResult, setQuizResult] = useState(null)
  const [quizHistory, setQuizHistory] = useState([])
  const [assignmentList, setAssignmentList] = useState([])
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentFile, setAssignmentFile] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [adminData, setAdminData] = useState({ students: [], overview: null })

  useEffect(() => {
    if (token) {
      setAuthToken(token)
    }
  }, [token])

  useEffect(() => {
    const valid = ['dashboard', 'chat', 'quiz', 'assignments', 'progress', 'admin']
    const path = window.location.pathname.replace(/^\//, '')
    const initialSection = valid.includes(path) ? path : 'dashboard'

    if (token) {
      setPage('app')
      setSection(initialSection)
      if (!valid.includes(path) || path === '') {
        try { window.history.replaceState({}, '', '/dashboard') } catch (e) {}
      }
      fetchProfile()
    }

    const onPop = () => {
      const p = window.location.pathname.replace(/^\//, '')
      if (p && valid.includes(p)) {
        setPage('app')
        setSection(p)
      } else {
        setPage('home')
        setSection('dashboard')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const isAuthenticated = Boolean(user)
  const isAdmin = user?.role === 'admin'

  const apiError = (message) => {
    setToast({ message, type: 'error' })
    window.setTimeout(() => setToast({ message: '', type: '' }), 3000)
  }

  const apiSuccess = (message) => {
    setToast({ message, type: 'success' })
    window.setTimeout(() => setToast({ message: '', type: '' }), 3000)
  }

  const handleAuthSuccess = (data) => {
    const tokenValue = data.token
    setTokenState(tokenValue)
    setAuthToken(tokenValue)
    localStorage.setItem('token', tokenValue)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    setAuthError('')
    setPage('app')
    setSection('dashboard')
    try { window.history.replaceState({}, '', '/dashboard') } catch (e) {}
    apiSuccess(`Welcome, ${data.user.name.split(' ')[0]}!`)
    fetchProfile()
  }

  const updateUserState = (updated) => {
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  const logout = () => {
    setUser(null)
    setTokenState('')
    setCurrentChatId(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setPage('home')
    setSection('dashboard')
    apiSuccess('Logged out. See you soon!')
  }

  const goHome = () => {
    if (isAuthenticated) {
      showApp('dashboard')
    } else {
      setPage('home')
      setSection('dashboard')
    }
  }

  const showApp = (target) => {
    if (!isAuthenticated) {
      setPage('auth')
      return
    }
    setPage('app')
    setSection(target)
    try { window.history.pushState({}, '', '/' + target) } catch (e) {}
    if (target === 'dashboard' || target === 'progress') fetchProfile()
    if (target === 'chat') loadChatHistory()
    if (target === 'quiz') loadQuizHistory()
    if (target === 'assignments') loadAssignments()
    if (target === 'admin' && isAdmin) loadAdmin()
  }

  const switchTab = (mode) => {
    setAuthMode(mode)
    setAuthError('')
  }

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setAuthError('Email and password required.')
      return
    }
    setAuthLoading(true)
    try {
      const response = await api.post('/auth/login', loginForm)
      handleAuthSuccess(response.data)
      setPage('app')
      setSection('dashboard')
    } catch (error) {
      setAuthError(error.response?.data?.error || error.message || 'Login failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      setAuthError('Name, email and password are required.')
      return
    }
    if (registerForm.password.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }
    setAuthLoading(true)
    try {
      const response = await api.post('/auth/register', registerForm)
      handleAuthSuccess(response.data)
      setPage('app')
      setSection('dashboard')
    } catch (error) {
      setAuthError(error.response?.data?.error || error.message || 'Registration failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  const fetchProfile = async () => {
    if (!token) return
    try {
      const response = await api.get('/auth/me')
      const updatedUser = response.data.user
      updateUserState(updatedUser)
      setDashboardData({
        totalMessages: updatedUser.stats?.totalMessages ?? 0,
        totalQuizzes: updatedUser.stats?.totalQuizzes ?? 0,
        totalAssignments: updatedUser.stats?.totalAssignments ?? 0,
        totalCorrect: updatedUser.stats?.totalCorrect ?? 0,
        topicsStudied: updatedUser.stats?.topicsStudied || [],
        topicScores: updatedUser.topicScores || []
      })
    } catch (error) {
      apiError(error.response?.data?.error || 'Unable to load profile.')
    }
  }

  const loadChatHistory = async () => {
    if (!isAuthenticated) return
    try {
      const response = await api.get('/chat/history')
      setChatHistory(response.data.chats || [])
    } catch (error) {
      apiError('Could not load chat history.')
    }
  }

  const loadQuizHistory = async () => {
    if (!isAuthenticated) return
    try {
      const response = await api.get('/quiz/my')
      setQuizHistory(response.data.quizzes || [])
    } catch (error) {
      apiError('Could not load quiz history.')
    }
  }

  const loadAdmin = async () => {
    if (!isAuthenticated || !isAdmin) return
    try {
      const [overviewRes, studentsRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/students')
      ])
      setAdminData({ overview: overviewRes.data, students: studentsRes.data.students })
    } catch (error) {
      apiError('Could not load admin overview.')
    }
  }

  const loadAssignments = async () => {
    if (!isAuthenticated) return
    setAssignmentLoading(true)
    try {
      const response = await api.get('/assignment')
      setAssignmentList(response.data.assignments || [])
    } catch (error) {
      apiError(error.response?.data?.error || 'Unable to load assignments.')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const uploadAssignment = async (file) => {
    if (!isAuthenticated) {
      apiError('Please login to upload an assignment.')
      return
    }
    if (!file) {
      setAssignmentError('Please select a file to upload.')
      return
    }
    setAssignmentError('')
    setAssignmentLoading(true)
    try {
      const payload = {
        title: file.name,
        subject: file.type || 'Uploaded Assignment',
        description: `Uploaded file: ${file.name}`
      }

      const response = await api.post('/assignment', payload)
      apiSuccess('Assignment uploaded successfully!')
      setModalOpen(false)
      setAssignmentFile(null)
      await loadAssignments()
      await fetchProfile()
      return response.data
    } catch (error) {
      console.error('Assignment upload error:', error.response?.data || error.message)
      setAssignmentError(error.response?.data?.error || 'Assignment upload failed.')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const handleNewAssignment = () => {
    if (!isAuthenticated) {
      setPage('auth')
      apiError('Please login to access assignments.')
      return
    }
    setPage('app')
    setSection('assignments')
    setModalOpen(true)
    try { window.history.pushState({}, '', '/assignments') } catch (e) {}
    loadAssignments()
  }

  const sendChat = async () => {
    if (!chatInput.trim()) return
    setChatLoading(true)
    const nextMessages = [...chatMessages, { role: 'user', text: chatInput.trim() }]
    setChatMessages(nextMessages)
    setChatInput('')
    try {
      const response = await api.post('/chat/ask', { message: nextMessages[nextMessages.length - 1].text, chatId: currentChatId })
      setCurrentChatId(response.data.chatId)
      setChatMessages((prev) => [...prev, { role: 'ai', text: response.data.reply }])
      loadChatHistory()
    } catch (error) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: `⚠️ ${error.response?.data?.error || error.message || 'Chat request failed.'}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const startNewChat = () => {
    setCurrentChatId(null)
    setChatMessages(initialMessages)
  }

  const quickSend = (prompt) => {
    setChatInput(prompt)
    setTimeout(() => sendChat(), 10)
  }

  const openChat = async (chatId) => {
    if (!chatId) return
    if (!isAuthenticated) {
      setPage('auth')
      apiError('Please log in to open chat history.')
      return
    }
    setPage('app')
    setSection('chat')
    try { window.history.pushState({}, '', '/chat') } catch (e) {}
    try {
      const response = await api.get(`/chat/${chatId}`)
      setCurrentChatId(chatId)
      setChatMessages(response.data.chat.messages.map((message) => ({
        role: message.role === 'user' ? 'user' : 'ai',
        text: message.content
      })))
      loadChatHistory()
    } catch (error) {
      apiError(error.response?.data?.error || 'Could not open selected chat.')
    }
  }

  const formatMessage = (text) => {
    if (!text) return ''
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>')
    return escaped
  }

  const generateQuiz = async () => {
    if (!quizTopic.trim()) {
      setQuizError('Please enter a topic.')
      return
    }
    setQuizError('')
    setQuizLoading(true)
    setActiveQuiz(null)
    setQuizResult(null)
    try {
      const response = await api.post('/quiz/generate', { topic: quizTopic.trim() })
      const quiz = response.data.quiz
      setActiveQuiz(quiz)
      setQuizAnswers(new Array(quiz.questions.length).fill(null))
      apiSuccess('Quiz ready!')
    } catch (error) {
      setQuizError(error.response?.data?.error || 'Quiz generation failed.')
    } finally {
      setQuizLoading(false)
    }
  }

  const selectAnswer = (questionIndex, answerIndex) => {
    if (!activeQuiz) return
    const updated = [...quizAnswers]
    updated[questionIndex] = answerIndex
    setQuizAnswers(updated)

    const quiz = activeQuiz
    const selected = answerIndex
    const correct = quiz.questions[questionIndex].answer
    const nextQuestion = questionIndex + 1

    if (nextQuestion < quiz.questions.length) {
      setTimeout(() => {
        setActiveQuiz({ ...quiz, currentQuestion: nextQuestion })
      }, 700)
    } else {
      submitQuiz(updated)
    }
  }

  const submitQuiz = async (answers) => {
    if (!activeQuiz) return
    try {
      const response = await api.post(`/quiz/${activeQuiz._id}/submit`, { answers, timeTaken: 0 })
      setQuizResult(response.data)
      await fetchProfile()
      loadQuizHistory()
      apiSuccess('Quiz submitted successfully!')
    } catch (error) {
      setQuizError(error.response?.data?.error || 'Quiz submission failed.')
    }
  }

  const dashboardStats = dashboardData || {
    totalMessages: user?.stats?.totalMessages ?? 0,
    totalQuizzes: user?.stats?.totalQuizzes ?? 0,
    totalAssignments: user?.stats?.totalAssignments ?? 0,
    totalCorrect: user?.stats?.totalCorrect ?? 0,
    topicsStudied: user?.stats?.topicsStudied || [],
    topicScores: user?.topicScores || []
  }
  const accuracy = dashboardStats.totalQuizzes > 0 ? Math.round((dashboardStats.totalCorrect / (dashboardStats.totalQuizzes * 5)) * 100) : 0

  const renderQuizPanel = () => {
    if (!activeQuiz) return null
    const currentIndex = activeQuiz.currentQuestion ?? 0
    const question = activeQuiz.questions[currentIndex]
    if (!question) return null
    return (
      <>
        <div className="quiz-progress">
          <div className="quiz-progress-bar" style={{ width: `${(currentIndex / activeQuiz.questions.length) * 100}%` }} />
        </div>
        <div className="quiz-qnum">Question {currentIndex + 1} of {activeQuiz.questions.length} — {activeQuiz.topic}</div>
        <div className="quiz-question">{question.question}</div>
        <div className="quiz-opts">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              className="quiz-opt"
              type="button"
              onClick={() => selectAnswer(currentIndex, idx)}
            >
              <strong>{String.fromCharCode(65 + idx)}.</strong> {option}
            </button>
          ))}
        </div>
      </>
    )
  }

  const appClass = page === 'app' ? 'active' : ''
  const sidebarOpen = page === 'app' ? 'open' : ''

  return (
    <div className="app-shell">
      <nav>
        <div className="nav-logo" onClick={goHome}>
          <span />StudyAI
        </div>
        {!isAuthenticated && (
          <div className="nav-guest">
            <button className="nav-btn nb-ghost" onClick={() => setPage('auth')}>Log in</button>
            <button className="nav-btn nb-fill" onClick={() => setPage('auth')}>Sign up free</button>
          </div>
        )}
        {isAuthenticated && (
          <div className="nav-user-info">
            <div className="nav-avatar">{user?.name ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}</div>
            <span>{user?.name || 'Student'}</span>
            <button className="nav-btn nb-ghost btn-sm" onClick={logout}>Log out</button>
          </div>
        )}
      </nav>

      <div className={`toast ${toast.message ? 'show ' + toast.type : ''}`}>{toast.message}</div>

      <div className={`layout ${sidebarOpen}`}>
        <aside className={`sidebar ${sidebarOpen}`}>
          <div className="sb-section">Main</div>
          <button className={`sb-item ${section === 'dashboard' ? 'active' : ''}`} onClick={() => showApp('dashboard')}>Dashboard</button>
          <button className={`sb-item ${section === 'chat' ? 'active' : ''}`} onClick={() => showApp('chat')}>AI Tutor</button>
          <button className={`sb-item ${section === 'quiz' ? 'active' : ''}`} onClick={() => showApp('quiz')}>Quiz Generator</button>
          <button className={`sb-item ${section === 'assignments' ? 'active' : ''}`} onClick={() => showApp('assignments')}>Assignments</button>
          <button className={`sb-item ${section === 'progress' ? 'active' : ''}`} onClick={() => showApp('progress')}>My Progress</button>
          {isAdmin && (
            <>
              <div className="sb-section">Admin</div>
              <button className={`sb-item ${section === 'admin' ? 'active' : ''}`} onClick={() => showApp('admin')}>Students</button>
            </>
          )}
          <div className="sb-spacer" />
          <div className="sb-user">
            <div className="sb-uname">{user?.name || 'Not signed in'}</div>
            <div className="sb-uemail">{user?.email || 'guest@studyai.com'}</div>
          </div>
        </aside>

        <main className={`main ${sidebarOpen}`}>
          <section className={`page ${page === 'home' ? 'active' : ''}`} id="page-home">
            <div className="hero">
              <div className="hero-badge">✨ Powered by GROQ AI</div>
              <h1>Study Smarter with Your <em>AI-Powered</em> Learning Assistant</h1>
              <p>Get instant explanations, AI-generated quizzes, assignment grading, and real-time progress tracking — all in one platform.</p>
              <div className="hero-btns">
                <button className="btn btn-p" onClick={() => setPage('auth')}>Get Started Free →</button>
                <button className="btn btn-o" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>See Features</button>
              </div>
            </div>
            <div id="features" style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 60px' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--p)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Features</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 30, fontWeight: 700, color: 'var(--t)' }}>Everything a student needs</div>
              </div>
              <div className="feat-grid" style={{ margin: 0 }}>
                <div className="feat-card" onClick={() => setPage('auth')}>
                  <div className="feat-icon">🤖</div>
                  <div className="feat-title">AI Tutor</div>
                  <div className="feat-desc">Ask anything — OOP, DBMS, Web Engineering, Algorithms, Data Structures, Networks, OS, Math, Physics, and more.</div>
                </div>
                <div className="feat-card" onClick={() => setPage('auth')}>
                  <div className="feat-icon">📝</div>
                  <div className="feat-title">Quiz Generator</div>
                  <div className="feat-desc">AI creates 5 custom MCQs on any topic. Instant scoring with detailed explanations.</div>
                </div>
                <div className="feat-card" onClick={() => setPage('auth')}>
                  <div className="feat-icon">📋</div>
                  <div className="feat-title">Assignment Grader</div>
                  <div className="feat-desc">Submit your assignments. AI grades them 0-100 with strengths, weaknesses, and feedback.</div>
                </div>
                <div className="feat-card" onClick={() => setPage('auth')}>
                  <div className="feat-icon">📈</div>
                  <div className="feat-title">Progress Tracking</div>
                  <div className="feat-desc">See your topic-wise performance, quiz history, and weak areas that need improvement.</div>
                </div>
              </div>
            </div>
          </section>

          <section className={`page ${page === 'auth' ? 'active' : ''}`} id="page-auth">
            <div className="auth-wrap">
              <div className="auth-card">
                <div className="auth-title">🧠 StudyAI</div>
                <div className="auth-sub">Your intelligent study companion</div>
                <div className="tabs">
                  <button className={`tab ${authMode === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Log in</button>
                  <button className={`tab ${authMode === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Sign up</button>
                </div>
                <div className={`form-section ${authMode === 'login' ? 'active' : ''}`}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      type="email"
                      placeholder="you@email.com"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className="form-input"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      type="password"
                      placeholder="••••••••"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                  <div className="form-error" style={{ display: authError && authMode === 'login' ? 'block' : 'none' }}>{authError}</div>
                  <button className="btn btn-p" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={authLoading} onClick={handleLogin}>
                    {authLoading ? 'Logging in...' : 'Log in'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--t3)' }}>
                    Demo: <strong>admin@studyai.com</strong> / <strong>admin123</strong>
                  </div>
                </div>
                <div className={`form-section ${authMode === 'register' ? 'active' : ''}`}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      type="text"
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      type="email"
                      placeholder="you@email.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">University / College</label>
                    <input
                      className="form-input"
                      value={registerForm.university}
                      onChange={(e) => setRegisterForm({ ...registerForm, university: e.target.value })}
                      type="text"
                      placeholder="COMSATS, FAST, UET..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className="form-input"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      type="password"
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div className="form-error" style={{ display: authError && authMode === 'register' ? 'block' : 'none' }}>{authError}</div>
                  <button className="btn btn-p" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={authLoading} onClick={handleRegister}>
                    {authLoading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className={`page ${page === 'app' ? 'active' : ''}`} id="page-app">
            <div id="app-dashboard" style={{ display: section === 'dashboard' ? 'block' : 'none' }}>
              <div className="page-title">Dashboard</div>
              <div className="page-sub">Welcome back, {user?.name?.split(' ')[0] || 'Student'}!</div>
              <div className="stats-row">
                <div className="stat-card"><div className="stat-val">{dashboardStats.totalMessages}</div><div className="stat-lbl">AI Messages</div></div>
                <div className="stat-card"><div className="stat-val">{dashboardStats.totalQuizzes}</div><div className="stat-lbl">Quizzes Taken</div></div>
                <div className="stat-card"><div className="stat-val">{dashboardStats.totalAssignments}</div><div className="stat-lbl">Assignments</div></div>
                <div className="stat-card"><div className="stat-val">{accuracy}%</div><div className="stat-lbl">Quiz Accuracy</div></div>
              </div>
              <div className="grid-2">
                <div className="card">
                  <div className="card-title">Quick Actions</div>
                  <div className="card-sub">Jump right in</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button className="btn btn-p btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showApp('chat')}>🤖 Ask AI Tutor</button>
                    <button className="btn btn-o btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showApp('quiz')}>📝 Generate Quiz</button>
                    <button className="btn btn-o btn-sm" style={{ justifyContent: 'flex-start' }} onClick={handleNewAssignment}>📋 Submit Assignment</button>
                    <button className="btn btn-o btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => showApp('progress')}>📈 View Progress</button>
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Topics Studied</div>
                  <div className="card-sub">Your learning history</div>
                  <div id="topics-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {dashboardStats.topicsStudied?.length ? (
                      dashboardStats.topicsStudied.map((topic) => (
                        <span key={topic} style={{ padding: '4px 12px', background: 'var(--pl)', color: 'var(--p)', borderRadius: 999, fontSize: 12, fontWeight: 500 }}>{topic}</span>
                      ))
                    ) : (
                      <div className="empty" style={{ padding: 20, width: '100%' }}><div className="empty-sub">Start chatting to track topics</div></div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div id="app-chat" style={{ display: section === 'chat' ? 'flex' : 'none', margin: '-32px -24px', height: 'calc(100vh - 60px)' }}>
              <div className="chat-layout">
                <div className="chat-sidebar">
                  <div className="chat-sidebar-head">
                    <span>Chat History</span>
                    <button className="btn btn-p btn-sm" onClick={startNewChat} style={{ padding: '5px 12px', fontSize: 12 }}>+ New</button>
                  </div>
                  <div className="chat-list">
                    {chatHistory.length === 0 ? (
                      <div className="empty" style={{ padding: '24px 12px' }}><div className="empty-sub">No chats yet</div></div>
                    ) : (
                      chatHistory.map((chat) => (
                        <div key={chat._id} className={`chat-list-item ${chat._id === currentChatId ? 'active-chat' : ''}`} onClick={() => openChat(chat._id)}>
                          <div className="cli-title">{chat.title}</div>
                          <div className="cli-meta">{chat.topic} · {new Date(chat.updatedAt).toLocaleDateString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="chat-main">
                  <div className="chat-topbar">
                    <div className="ai-dot" />
                    <div>
                      <div className="chat-topbar-title">StudyAI Tutor</div>
                      <div className="chat-topbar-sub">Powered by Google Gemini — always online</div>
                    </div>
                    <button className="btn btn-gray btn-sm" style={{ marginLeft: 'auto' }} onClick={startNewChat}>New Chat</button>
                  </div>
                  <div className="chat-messages">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`msg ${message.role === 'user' ? 'user' : 'ai'}`}>
                        <div className={`msg-av ${message.role === 'user' ? 'av-u' : 'av-ai'}`}>
                          {message.role === 'user' ? user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'AI'}
                        </div>
                        <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: formatMessage(message.text) }} />
                      </div>
                    ))}
                    <div className="quick-chips">
                      {quickPrompts.map((prompt) => (
                        <span key={prompt} className="chip" onClick={() => quickSend(prompt)}>{prompt}</span>
                      ))}
                    </div>
                    {chatLoading && (
                      <div className="typing show">
                        <div className="msg-av av-ai">AI</div>
                        <div className="typing-dots">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="chat-input-area">
                    <div className="chat-input-row">
                      <textarea
                        className="chat-ta"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask any study question... (Enter to send, Shift+Enter for new line)"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendChat()
                          }
                        }}
                      />
                      <button className="send-btn" disabled={chatLoading} onClick={sendChat}>
                        <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="app-quiz" style={{ display: section === 'quiz' ? 'block' : 'none' }}>
              <div className="page-title">Quiz Generator</div>
              <div className="page-sub">AI creates custom MCQs on any topic — tests are scored and saved</div>
              <div className="grid-2">
                <div>
                  <div className="card mb-16">
                    <div className="card-title">Generate New Quiz</div>
                    <div className="card-sub">Type a topic and AI will create 5 questions</div>
                    <div className="form-group">
                      <label className="form-label">Topic</label>
                      <input className="form-input" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g. OOP, SQL Queries, Binary Trees, TCP/IP..." />
                    </div>
                    <div className="form-error" style={{ display: quizError ? 'block' : 'none' }}>{quizError}</div>
                    <button className="btn btn-p" disabled={quizLoading} onClick={generateQuiz}>{quizLoading ? 'Generating...' : 'Generate Quiz →'}</button>
                  </div>
                  <div className="card" style={{ display: activeQuiz ? 'block' : 'none' }}>
                    <div id="quiz-body">{renderQuizPanel()}</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Quiz History</div>
                  <div className="card-sub">Your past quiz results</div>
                  <div id="quiz-history">
                    {quizHistory.length === 0 ? (
                      <div className="empty"><div className="empty-icon">📝</div><div className="empty-text">No quizzes yet</div></div>
                    ) : (
                      quizHistory.map((quiz) => (
                        <div key={quiz._id} className="asgn-card">
                          <div className="asgn-head"><div className="asgn-title">{quiz.topic}</div><div className="badge badge-pending">{quiz.score}/{quiz.total}</div></div>
                          <div className="asgn-desc">Taken on {new Date(quiz.createdAt).toLocaleDateString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div id="app-assignments" style={{ display: section === 'assignments' ? 'block' : 'none' }}>
              <div className="flex-between mb-24">
                <div>
                  <div className="page-title">Assignments</div>
                  <div className="page-sub">Submit assignments — AI grades and gives detailed feedback</div>
                </div>
                <button className="btn btn-p" onClick={handleNewAssignment}>+ New Assignment</button>
              </div>
              <div id="assignment-list">
                {assignmentLoading ? (
                  <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading assignments...</div></div>
                ) : assignmentList.length === 0 ? (
                  <div className="empty"><div className="empty-icon">📋</div><div className="empty-text">No assignments yet</div><div className="empty-sub">Click "+ New Assignment" to add one</div></div>
                ) : (
                  assignmentList.map((assignment) => (
                    <div key={assignment._id} className="asgn-card">
                      <div className="asgn-head">
                        <div>
                          <div className="asgn-title">{assignment.title}</div>
                          <div className="asgn-subject">{assignment.subject}</div>
                        </div>
                        <div className={`badge ${assignment.status === 'graded' ? 'badge-graded' : assignment.status === 'submitted' ? 'badge-submitted' : 'badge-pending'}`}>
                          {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                        </div>
                      </div>
                      <div className="asgn-desc">{assignment.description}</div>
                      {assignment.aiGrade != null && (
                        <div className="feedback-box">
                          <div className="grade-display">Grade: {assignment.aiGrade}%</div>
                          <div>{assignment.aiFeedback}</div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div id="app-progress" style={{ display: section === 'progress' ? 'block' : 'none' }}>
              <div className="page-title">My Progress</div>
              <div className="page-sub">Track your performance across topics</div>
              <div className="stats-row mb-24">
                <div className="stat-card"><div className="stat-val">{dashboardStats.totalQuizzes}</div><div className="stat-lbl">Total Quizzes</div></div>
                <div className="stat-card"><div className="stat-val">{dashboardStats.totalCorrect}</div><div className="stat-lbl">Correct Answers</div></div>
                <div className="stat-card"><div className="stat-val">{accuracy}%</div><div className="stat-lbl">Overall Accuracy</div></div>
                <div className="stat-card"><div className="stat-val">{dashboardStats.totalAssignments}</div><div className="stat-lbl">Assignments Graded</div></div>
              </div>
              <div className="grid-2">
                <div className="card">
                  <div className="card-title">Topic Performance</div>
                  <div className="card-sub">Based on your quizzes</div>
                  <div id="topic-bars">
                    {dashboardStats.topicScores?.length ? (
                      dashboardStats.topicScores.map((topic) => {
                        const pct = Math.round((topic.correct / topic.total) * 100)
                        const colorClass = pct >= 70 ? 'bar-strong' : pct >= 40 ? 'bar-medium' : 'bar-weak'
                        return (
                          <div key={topic.topic} className="topic-bar">
                            <div className="topic-bar-head"><div className="topic-bar-name">{topic.topic}</div><div className="topic-bar-pct">{pct}%</div></div>
                            <div className="bar-bg"><div className={`bar-fill ${colorClass}`} style={{ width: `${pct}%` }} /></div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="empty" style={{ padding: 20 }}><div className="empty-sub">Take quizzes to see topic breakdown</div></div>
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Recent Quiz Results</div>
                  <div className="card-sub">Last 10 quizzes</div>
                  <div id="recent-quizzes">
                    {quizHistory.length === 0 ? (
                      <div className="empty" style={{ padding: 20 }}><div className="empty-sub">No quizzes yet</div></div>
                    ) : (
                      quizHistory.map((quiz) => (
                        <div key={quiz._id} className="asgn-card">
                          <div className="asgn-head"><div className="asgn-title">{quiz.topic}</div><div className="badge badge-pending">{quiz.score}/{quiz.total}</div></div>
                          <div className="asgn-desc">{new Date(quiz.createdAt).toLocaleDateString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div id="app-admin" style={{ display: section === 'admin' ? 'block' : 'none' }}>
                <div className="page-title">Student Monitoring</div>
                <div className="page-sub">Overview of all students' activity and performance</div>
                <div className="stats-row mb-24" id="admin-stats">
                  <div className="stat-card"><div className="stat-val">{adminData.overview?.totalStudents ?? '—'}</div><div className="stat-lbl">Total Students</div></div>
                  <div className="stat-card"><div className="stat-val">{adminData.overview?.totalQuizzes ?? '—'}</div><div className="stat-lbl">Quizzes Taken</div></div>
                  <div className="stat-card"><div className="stat-val">{adminData.overview?.totalChats ?? '—'}</div><div className="stat-lbl">AI Conversations</div></div>
                  <div className="stat-card"><div className="stat-val">{adminData.overview?.totalAssignments ?? '—'}</div><div className="stat-lbl">Assignments Graded</div></div>
                </div>
                <div className="card">
                  <div className="flex-between mb-16"><div className="card-title">All Students</div></div>
                  <div id="admin-students">
                    {adminData.students.length === 0 ? (
                      <div className="empty"><div className="empty-icon">👥</div><div className="empty-text">Loading students...</div></div>
                    ) : (
                      adminData.students.map((student) => (
                        <div key={student._id} className="student-row">
                          <div className="s-av">{student.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                          <div>
                            <div className="s-name">{student.name}</div>
                            <div className="s-email">{student.email}</div>
                          </div>
                          <div className="s-stats">
                            <div className="s-stat"><div className="s-stat-val">{student.stats?.totalMessages ?? 0}</div><div className="s-stat-lbl">Messages</div></div>
                            <div className="s-stat"><div className="s-stat-val">{student.stats?.totalQuizzes ?? 0}</div><div className="s-stat-lbl">Quizzes</div></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {modalOpen && (
              <div className="modal-overlay open">
                <div className="modal">
                  <div className="modal-title">Upload Assignment</div>
                  <div className="modal-sub">Select a file to submit and upload it to StudyAI.</div>
                  <div className="form-group">
                    <label className="form-label">Assignment file</label>
                    <input
                      className="form-input"
                      type="file"
                      onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  {assignmentError && <div className="form-error">{assignmentError}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                    <button className="btn btn-gray" type="button" onClick={() => { setModalOpen(false); setAssignmentFile(null); setAssignmentError('') }}>
                      Cancel
                    </button>
                    <button className="btn btn-p" type="button" disabled={assignmentLoading} onClick={() => uploadAssignment(assignmentFile)}>
                      {assignmentLoading ? 'Uploading...' : 'Upload Assignment'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
