import { useState } from 'react'
import { LogIn, UserPlus, Activity, CheckCircle, AlertTriangle } from 'lucide-react'
import { api } from './api'
import './index.css'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  
  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('CITIZEN')
  
  // UI State
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isLogin) {
        // Backend Integration: Login Route
        const data = await api.login(email, password)
        localStorage.setItem('access_token', data.access_token)
        setSuccess('Successfully authenticated! Secure token stored.')
        // Placeholder for future routing to the Dashboard
      } else {
        // Backend Integration: Register Route
        await api.register(email, password, fullName, role)
        setSuccess('Account created beautifully! Switching to login...')
        setTimeout(() => {
            setIsLogin(true)
            setPassword('') // Clear password for security
            setSuccess('')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleView = () => {
    setIsLogin(!isLogin)
    setError('')
    setSuccess('')
    setPassword('')
  }

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
          <img 
            src="/logo.png" 
            alt="CivicLens Logo" 
            style={{ 
              width: '84px', 
              height: '84px', 
              borderRadius: '20px', 
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)' 
            }} 
          />
          CivicLens
        </div>
        <div className="auth-subtitle">
          {isLogin ? 'Access the Municipal Dashboard' : 'Join as a Municipal Official / Citizen'}
        </div>
      </div>

      {success && (
        <div className="success-msg">
          <CheckCircle size={18} /> {success}
        </div>
      )}
      
      {error && (
        <div className="error-msg">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              required 
              type="text" 
              className="form-input" 
              placeholder="e.g. Jane Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input 
            required 
            type="email" 
            className="form-input" 
            placeholder="admin@civiclens.gov"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Secure Password</label>
          <input 
            required 
            type="password" 
            className="form-input" 
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {!isLogin && (
          <div className="form-group">
            <label className="form-label">Access Role</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="CITIZEN">Citizen (Reporter)</option>
              <option value="GOVT_OFFICIAL">Government Worker (Assignee)</option>
              <option value="NGO_ADMIN">NGO Admin (Triage Dashboard)</option>
            </select>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <Activity className="animate-spin" size={20} />
          ) : isLogin ? (
            <><LogIn size={20} /> Secure Login</>
          ) : (
            <><UserPlus size={20} /> Register Account</>
          )}
        </button>
      </form>

      <div className="auth-switch">
        <span>{isLogin ? "Don't have an official account?" : "Already an official?"}</span>
        <button 
          type="button"
          onClick={toggleView}
          className="auth-switch-link"
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
        >
          {isLogin ? 'Register Here' : 'Login Here'}
        </button>
      </div>
    </div>
  )
}

export default App
