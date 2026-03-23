/*
 * AuthPage.jsx — real auth, no fake login, Google Sign In supported
 */
import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { authAPI } from '../utils/api'
import './AuthPage.css'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function AuthPage({ defaultTab = 'login', onLogin, onBack }) {
  const { showToast } = useToast()
  const [tab,     setTab]     = useState(defaultTab)
  const [loading, setLoading] = useState(false)

  // login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass,  setLoginPass]  = useState('')

  // signup fields
  const [signupName,  setSignupName]  = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPass,  setSignupPass]  = useState('')

  // ── Handle Google redirect callback ───────────────────────
  // After Google login, backend redirects to /auth/success?token=...&user=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    const user   = params.get('user')
    const error  = params.get('error')

    if (error) {
      showToast('Google sign in failed, please try again', 'error')
      window.history.replaceState({}, '', '/') // clean URL
      return
    }

    if (token && user) {
      try {
        localStorage.setItem('rh_token', token)
        const parsedUser = JSON.parse(decodeURIComponent(user))
        showToast(`Welcome, ${parsedUser.name}! 👋`, 'success')
        window.history.replaceState({}, '', '/') // clean URL
        onLogin(parsedUser)
      } catch {
        showToast('Something went wrong with Google login', 'error')
      }
    }
  }, [])

  // ── Login ──────────────────────────────────────────────────
  async function handleLogin() {
    if (!loginEmail || !loginPass) { showToast('Please fill in all fields', 'error'); return }
    try {
      setLoading(true)
      const data = await authAPI.login(loginEmail, loginPass)
      localStorage.setItem('rh_token', data.token)
      showToast(`Welcome back, ${data.user.name}! 👋`, 'success')
      onLogin(data.user)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Signup ─────────────────────────────────────────────────
  async function handleSignup() {
    if (!signupName || !signupEmail || !signupPass) { showToast('Please fill in all fields', 'error'); return }
    if (signupPass.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    try {
      setLoading(true)
      const data = await authAPI.signup(signupName, signupEmail, signupPass)
      localStorage.setItem('rh_token', data.token)
      showToast(`Account created! Welcome, ${data.user.name} 🎉`, 'success')
      onLogin(data.user)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Google Sign In ─────────────────────────────────────────
  function handleGoogle() {
    // Redirects to backend which redirects to Google
  window.location.href = 'https://reachhirejobs-backend.onrender.com/api/auth/google'
  }

  return (
    <div className="ap-page">
      <div className="ap-card">
        <div className="ap-logo">Reach<span>Hire</span></div>
        <div className="ap-tagline">Get your CV to 1,223+ tech companies across Africa</div>

        {/* Tabs */}
        <div className="ap-tabs">
          <button className={`ap-tab ${tab === 'login'  ? 'ap-active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
          <button className={`ap-tab ${tab === 'signup' ? 'ap-active' : ''}`} onClick={() => setTab('signup')}>Sign Up</button>
        </div>

        {/* ── Login ── */}
        {tab === 'login' && (
          <div>
            <div className="ap-group">
              <label className="ap-label">Email Address</label>
              <input className="rh-input" type="email" placeholder="you@example.com"
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            </div>
            <div className="ap-group">
              <label className="ap-label">Password</label>
              <input className="rh-input" type="password" placeholder="••••••••"
                value={loginPass} onChange={e => setLoginPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button className="ap-submit-btn" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
            <div className="ap-divider">or</div>
            <button className="ap-google-btn" onClick={handleGoogle}>
              <GoogleIcon /> Continue with Google
            </button>
          </div>
        )}

        {/* ── Signup ── */}
        {tab === 'signup' && (
          <div>
            <div className="ap-group">
              <label className="ap-label">Full Name</label>
              <input className="rh-input" type="text" placeholder="John Doe"
                value={signupName} onChange={e => setSignupName(e.target.value)} />
            </div>
            <div className="ap-group">
              <label className="ap-label">Email Address</label>
              <input className="rh-input" type="email" placeholder="you@example.com"
                value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
            </div>
            <div className="ap-group">
              <label className="ap-label">Password</label>
              <input className="rh-input" type="password" placeholder="Min. 8 characters"
                value={signupPass} onChange={e => setSignupPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()} />
            </div>
            <button className="ap-submit-btn" onClick={handleSignup} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
            <div className="ap-divider">or</div>
            <button className="ap-google-btn" onClick={handleGoogle}>
              <GoogleIcon /> Continue with Google
            </button>
          </div>
        )}

        <span className="ap-back" onClick={onBack}>← Back to homepage</span>
      </div>
    </div>
  )
}
