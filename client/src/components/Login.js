import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { validateEmail } from '../utils/validation';
import ValidationError from './ValidationError';
import { useTranslation } from '../i18n/useTranslation';
import LanguageSelector from './LanguageSelector';
import { API_BASE, api } from '../api';

const GOOGLE_G_ICON = `
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
`;

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
  const [forgotStep, setForgotStep] = useState('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [errors, setErrors] = useState({ forgotEmail: '', otp: '', newPassword: '', confirmPassword: '' });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleBtnReady, setGoogleBtnReady] = useState(false);
  const googleScriptRef = useRef(null);
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
    loadGoogleScript(() => {});
    return () => {
      if (googleScriptRef.current) {
        document.body.removeChild(googleScriptRef.current);
        googleScriptRef.current = null;
      }
    };
  }, []);

  const initGoogle = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        callback: handleGoogleResponse,
        locale: 'en',
      });
      setGoogleBtnReady(true);
      return true;
    }
    return false;
  };

  const loadGoogleScript = (onReady) => {
    if (initGoogle()) {
      onReady();
      return;
    }
    if (!googleScriptRef.current) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      googleScriptRef.current = script;
      document.body.appendChild(script);
    }
    googleScriptRef.current.onload = () => {
      if (initGoogle()) onReady();
    };
  };

  const handleGoogleClick = () => {
    setError('');
    loadGoogleScript(() => {
      try {
        if (window.google && window.google.accounts) {
          window.google.accounts.id.prompt();
        }
      } catch (err) {
        console.error('Google sign-in error:', err);
        setError(t('common.googleSignInFailed'));
      }
    });
  };

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

  const closeForgot = () => {
    setShowForgot(false);
    setForgotMsg('');
    setForgotError('');
    setForgotEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotStep('email');
    setErrors({ forgotEmail: '', otp: '', newPassword: '', confirmPassword: '' });
  };

  // Step 1: check the email against the users database and send a 6-digit OTP.
  const handleSendOtp = async (e, isResend = false) => {
    if (e) e.preventDefault();
    const targetEmail = forgotEmail;
    const err = validateField('forgotEmail', targetEmail);
    if (err) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');
    try {
      await api.post('/api/auth/forgot-password-otp', { email: targetEmail });
      setForgotMsg(t('common.otpSent'));
      if (!isResend) setForgotStep('otp');
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: verify the OTP and its expiration.
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setErrors(prev => ({ ...prev, otp: t('common.otpMustBe6Digits') }));
      return;
    }
    setErrors(prev => ({ ...prev, otp: '' }));
    setForgotLoading(true);
    setForgotError('');
    try {
      const data = await api.post('/api/auth/verify-otp', { email: forgotEmail, otp: code });
      if (data.valid) {
        setForgotStep('password');
        setForgotMsg('');
      } else if (data.reason === 'expired') {
        setForgotError(t('common.otpExpired'));
      } else if (data.reason === 'locked') {
        setForgotError(t('common.otpLocked'));
      } else {
        setForgotError(t('common.invalidOtp'));
      }
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 3: validate with the existing password rules and reset.
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setErrors(prev => ({ ...prev, newPassword: t('validation.passwordRequired') }));
      return;
    }
    if (newPassword.length < 6) {
      setErrors(prev => ({ ...prev, newPassword: t('validation.passwordMin', { min: 6 }) }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: t('validation.passwordMismatch') }));
      return;
    }
    setErrors(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
    setForgotLoading(true);
    setForgotError('');
    try {
      await api.post('/api/auth/reset-password-otp', { email: forgotEmail, otp: otp.trim(), password: newPassword });
      setForgotMsg(t('common.passwordResetSuccess'));
      setTimeout(closeForgot, 2500);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
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
                onChange={(e) => setUsernameOrEmail(e.target.value)}
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
          <button
            type="button"
            className="google-btn"
            onClick={handleGoogleClick}
          >
            <span className="google-btn-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GOOGLE_G_ICON }} />
            <span className="google-btn-text">{t('common.googleContinue')}</span>
          </button>
          {googleLoading && <div className="google-loading">{t('common.googleSignIn')}</div>}
        </div>

        <p className="signup-link">
          {t('common.noAccount')} <button type="button" className="signup-btn" onClick={() => navigate('/signup')}>{t('common.signUp')}</button>
        </p>
      </div>

      {showForgot && (
        <div className="modal-overlay" onClick={closeForgot}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t('common.resetPassword')}</h3>
            {forgotStep === 'email' && <p>{t('common.enterEmail')}</p>}
            {forgotStep === 'otp' && <p>{t('common.otpSent')}</p>}
            {forgotStep === 'password' && <p>{t('common.setNewPassword')}</p>}
            {forgotMsg && <div style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{forgotMsg}</div>}
            {forgotError && <div className="login-error" style={{ marginBottom: '16px' }}>{forgotError}</div>}
            {forgotStep === 'email' && (
              <form onSubmit={handleSendOtp}>
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
                  <button type="button" className="btn btn-outline" onClick={closeForgot}>{t('common.cancel')}</button>
                  <button type="submit" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={forgotLoading}>
                    {forgotLoading ? t('common.signingIn') : t('common.sendResetLink')}
                  </button>
                </div>
              </form>
            )}
            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <div className="login-field">
                  <div className="login-input-wrapper">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors(prev => ({ ...prev, otp: '' })); }}
                      placeholder={t('common.enterOtpCode')}
                      className={errors.otp ? 'input-error' : ''}
                      style={{ letterSpacing: '8px', textAlign: 'center', fontWeight: 700, fontSize: '18px' }}
                      required
                    />
                  </div>
                  <ValidationError message={errors.otp} />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button type="button" className="forgot-link" onClick={(e) => handleSendOtp(e, true)} disabled={forgotLoading}>
                    {t('common.resendCode')}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={closeForgot}>{t('common.cancel')}</button>
                  <button type="submit" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={forgotLoading}>
                    {forgotLoading ? t('common.signingIn') : t('common.verifyCode')}
                  </button>
                </div>
              </form>
            )}
            {forgotStep === 'password' && (
              <form onSubmit={handleResetPassword}>
                <div className="login-field">
                  <div className="login-input-wrapper">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('common.newPassword')}
                      className={errors.newPassword ? 'input-error' : ''}
                      required
                    />
                  </div>
                  <ValidationError message={errors.newPassword} />
                </div>
                <div className="login-field">
                  <div className="login-input-wrapper">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('common.confirmPassword')}
                      className={errors.confirmPassword ? 'input-error' : ''}
                      required
                    />
                  </div>
                  <ValidationError message={errors.confirmPassword} />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={closeForgot}>{t('common.cancel')}</button>
                  <button type="submit" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={forgotLoading}>
                    {forgotLoading ? t('common.signingIn') : t('common.resetPasswordBtn')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
