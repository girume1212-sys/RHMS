import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-brand">
            <div className="login-logo">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#1e3a5f"/>
                <path d="M16 18C16 15.79 17.79 14 20 14H28C30.21 14 32 15.79 32 18V22C32 24.21 30.21 26 28 26H20C17.79 26 16 24.21 16 22V18Z" fill="#4da6ff"/>
                <circle cx="24" cy="32" r="4" fill="#4da6ff"/>
                <path d="M20 36H28" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1>RHMS</h1>
            <p>Support System</p>
          </div>
          <div className="login-features">
            <div className="feature-item">
              <div className="feature-icon">📋</div>
              <div>
                <h3>Track Requests</h3>
                <p>Manage all support requests in one place</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">👥</div>
              <div>
                <h3>Team Collaboration</h3>
                <p>Assign and collaborate with your team</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div>
                <h3>Analytics</h3>
                <p>Get insights with detailed reports</p>
              </div>
            </div>
          </div>
        </div>
        <div className="login-right">
          <form onSubmit={handleSubmit} className="login-form">
            <h2>Welcome Back</h2>
            <p className="login-subtitle">Sign in to your account</p>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="demo-credentials">
              <p><strong>Demo Accounts:</strong></p>
              <div className="demo-list">
                <span onClick={() => { setEmail('admin@rhms.com'); setPassword('admin123'); }}>Admin: admin@rhms.com</span>
                <span onClick={() => { setEmail('support@rhms.com'); setPassword('support123'); }}>Support: support@rhms.com</span>
                <span onClick={() => { setEmail('dev@rhms.com'); setPassword('dev123'); }}>Developer: dev@rhms.com</span>
                <span onClick={() => { setEmail('james@client.com'); setPassword('client123'); }}>Client: james@client.com</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
