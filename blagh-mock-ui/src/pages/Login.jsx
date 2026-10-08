import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, isAuthenticated, syncReporterConfig } from '../utils/auth'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) navigate('/dashboard', { replace: true })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      syncReporterConfig(user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function fillUser(e, un, pw) {
    e.preventDefault()
    setUsername(un)
    setPassword(pw)
    setError('')
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-content">
          <div className="login-brand-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <h1 className="login-brand-name">Blagh</h1>
          <p className="login-brand-tag">Your unified employee portal for managing teams, leaves, and announcements — all in one place.</p>
          <div className="login-features">
            {['Employee Directory', 'Leave Management', 'Announcements', 'Issue Reporting'].map(f => (
              <div key={f} className="login-feature-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {f}
              </div>
            ))}
          </div>
          <div className="login-idp-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Secured by Keycloak SSO
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Welcome back</h2>
            <p>Sign in with your Keycloak credentials</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="username">Username / User ID</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. 3033"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <span className="login-spinner" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="login-hints">
            <p className="login-hints-title">Demo account</p>
            <button className="login-hint-btn" onClick={e => fillUser(e, '3033', '123')}>
              <span className="hint-avatar" style={{ background: '#f97316' }}>KC</span>
              <span>
                <strong>Keycloak User 3033</strong>
                <span>Username: 3033 · Password: 123</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
