import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { validateEmail } from '../utils/validation';
import ValidationError from './ValidationError';
import { useTranslation } from '../i18n/useTranslation';
import LanguageSelector from './LanguageSelector';
import { API_BASE } from '../api';

export default function Login() {
  const { t } = useTranslation();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [errors, setErrors] = useState({ forgotEmail: '' });
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('rhms_remember');
    if (saved) {
      const data = JSON.parse(saved);
      setUsernameOrEmail(data.usernameOrEmail || '');
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
          callback: handleGoogleResponse,
          locale: 'en',
        });
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            shape: 'rectangular',
          });
        }
      }
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handleGoogleResponse = async (response) => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.googleSignInFailed'));
      localStorage.setItem('rhms_token', data.token);
      if (data.user.role === 'client') {
        navigate('/client');
      } else {
        navigate('/');
      }
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const validateField = (name, value) => {
    let err = '';
    if (name === 'forgotEmail' || name === 'usernameOrEmail') err = validateEmail(value);
    setErrors(prev => ({ ...prev, [name]: err }));
    return err;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('rhms_remember', JSON.stringify({ usernameOrEmail }));
      } else {
        localStorage.removeItem('rhms_remember');
      }
      const user = await login(usernameOrEmail, usernameOrEmail, password);
      if (user.role === 'client') {
        navigate('/client');
      } else {
        navigate('/');
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid username') || msg.includes('invalidCredentials')) {
        setError(t('common.invalidCredentials'));
      } else if (msg.includes('Cannot connect to server')) {
        setError(t('common.cannotConnectServer'));
      } else if (msg.includes('Account locked')) {
        setError(t('common.accountLocked'));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    const err = validateField('forgotEmail', forgotEmail);
    if (err) return;
    setForgotMsg(t('common.resetLinkSent'));
    setTimeout(() => { setShowForgot(false); setForgotMsg(''); setForgotEmail(''); }, 3000);
  };

  return (
    <div className="login-page">
      <div className="login-orbs">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
      </div>

      <LanguageSelector variant="login" />

      <div className="login-card">
        <h2 className="login-title">{t('common.login')}</h2>
        <p className="login-subtitle">{t('common.welcomeSubtitle')}</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value.replace(/\s/g, ''))}
                onKeyDown={(e) => e.key === ' ' && e.preventDefault()}
                placeholder={t('common.userNameOrEmail')}
                required
              />
            </div>
          </div>

          <div className="login-field">
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('common.password')}
                required
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? t('common.hide') : t('common.show')}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark"></span>
              <span>{t('common.rememberMe')}</span>
            </label>
            <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>
              {t('common.forgotPassword')}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t('common.signingIn') : t('common.signIn')}
          </button>
        </form>

        <div className="login-divider">
          <span>{t('common.or')}</span>
        </div>

        <div className="google-btn-wrapper">
          <div ref={googleBtnRef} className="google-btn-container"></div>
          {googleLoading && <div className="google-loading">{t('common.googleSignIn')}</div>}
        </div>

        <p className="signup-link">
          {t('common.noAccount')} <button type="button" className="signup-btn" onClick={() => navigate('/signup')}>{t('common.signUp')}</button>
        </p>
      </div>

      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t('common.resetPassword')}</h3>
            <p>{t('common.resetLinkSent')}</p>
            {forgotMsg && <div className="login-error" style={{ marginBottom: '16px' }}>{forgotMsg}</div>}
            <form onSubmit={handleForgotPassword}>
              <div className="login-field">
                <div className="login-input-wrapper">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => { setForgotEmail(e.target.value); validateField('forgotEmail', e.target.value); }}
                    placeholder={t('common.enterEmail')}
                    className={errors.forgotEmail ? 'input-error' : ''}
                    required
                  />
                </div>
                <ValidationError message={errors.forgotEmail} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowForgot(false); setForgotMsg(''); setForgotEmail(''); }}>{t('common.cancel')}</button>
                <button type="submit" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }}>{t('common.sendResetLink')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
