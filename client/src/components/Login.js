import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { validateEmail } from '../utils/validation';
import ValidationError from './ValidationError';
import { useTranslation } from '../i18n/useTranslation';
import LanguageSelector from './LanguageSelector';
import Icon from './Icon';
import { api, API_BASE } from '../api';

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
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState({ forgotEmail: '', otp: '', newPassword: '', confirmPassword: '' });
  const { login, systemName, systemLogo } = useAuth();
  const navigate = useNavigate();
  const otpRefs = useRef([]);
  const [resendSeconds, setResendSeconds] = useState(0);

  // Countdown for resend-code button (UI only)
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSeconds]);

  // Auto-dismiss the green success notice so it doesn't linger on screen.
  useEffect(() => {
    if (!forgotMsg) return;
    const id = setTimeout(() => setForgotMsg(''), 5000);
    return () => clearTimeout(id);
  }, [forgotMsg]);

  useEffect(() => {
    const saved = localStorage.getItem('rhms_remember');
    if (saved) {
      const data = JSON.parse(saved);
      setUsernameOrEmail(data.usernameOrEmail || '');
      setRememberMe(true);
    }
  }, []);

  const validateField = (name, value) => {
    let err = '';
    if (name === 'forgotEmail' || name === 'usernameOrEmail') err = validateEmail(value);
    setErrors(prev => ({ ...prev, [name]: err }));
    return err;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
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
      } else if (msg.includes('no longer exists')) {
        setError(t('common.accountDeleted'));
      } else if (msg.includes('blocked')) {
        setError('Your account is blocked. Please contact the administrator.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setResendSeconds(0);
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
    if (forgotLoading) return; // prevent duplicate/hanging requests from the same click
    const targetEmail = forgotEmail;
    const err = validateField('forgotEmail', targetEmail);
    if (err) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');
    try {
      const data = await api.post('/api/auth/forgot-password-otp', { email: targetEmail });
      // Cooldown responses (resent:false) mean nothing new was mailed — don't
      // claim success, just run the countdown until resend is allowed again.
      if (data.resent === false) {
        setForgotMsg('');
      } else {
        setForgotMsg(t('common.otpSent'));
      }
      setResendSeconds(data.retryAfter || 60);
      if (!isResend) {
        setForgotStep('otp');
      }
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: verify the OTP and its expiration.
  // --- OTP 6-box UI handlers (UI only, otp string state unchanged) ---
  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    const digits = otp.padEnd(6, ' ').split('').slice(0, 6);
    if (!clean) {
      digits[index] = ' ';
      setOtp(digits.join('').replace(/ /g, ''));
      setErrors(prev => ({ ...prev, otp: '' }));
      return;
    }
    // If user typed/pasted multiple digits into one box, spread them forward
    const chars = clean.slice(0, 6 - index).split('');
    chars.forEach((ch, k) => { digits[index + k] = ch; });
    setOtp(digits.join('').replace(/ /g, '').slice(0, 6));
    setErrors(prev => ({ ...prev, otp: '' }));
    const next = Math.min(index + chars.length, 5);
    otpRefs.current[next]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const digits = otp.padEnd(6, ' ').split('').slice(0, 6);
      if (digits[index] !== ' ') {
        digits[index] = ' ';
      } else if (index > 0) {
        digits[index - 1] = ' ';
        otpRefs.current[index - 1]?.focus();
      }
      setOtp(digits.join('').replace(/ /g, ''));
      setErrors(prev => ({ ...prev, otp: '' }));
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setOtp(pasted);
    setErrors(prev => ({ ...prev, otp: '' }));
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

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
        // Verified: the 60-second window is over — stop the countdown for good.
        // The password step has no timer; the user may take as long as needed.
        setResendSeconds(0);
        setForgotStep('password');
        setForgotMsg('');
        setForgotError('');
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
  // Minimum length is enforced by the backend (system_settings.passwordLength);
  // backend errors are shown as-is so they never disagree with the UI.
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setErrors(prev => ({ ...prev, newPassword: t('validation.passwordRequired') }));
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
      // Password saved: close the reset flow and land on the Login page with
      // a success message. The user signs in with the new password.
      const resetEmail = forgotEmail;
      closeForgot();
      setUsernameOrEmail(resetEmail);
      setNotice(t('common.passwordResetSuccess'));
    } catch (err) {
      const msg = err.message || '';
      // The 60s OTP window can lapse while the user types the new password.
      // Send them back to the code step with a resend available, not a dead end.
      if (msg.includes('expired')) {
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setResendSeconds(0);
        setForgotStep('otp');
        setForgotError(t('common.otpExpired'));
      } else {
        setForgotError(msg);
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const backToLogin = () => {
    closeForgot();
  };

  return (
    <div className="login-page">
      <div className="login-orbs">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
      </div>

      <LanguageSelector variant="login" />

      <div className="login-card">
        <div className="login-brand-header">
          {systemLogo ? (
            <img src={`${API_BASE}${systemLogo}`} alt="System logo" className="login-brand-logo" />
          ) : (
            <img src="http://localhost:5000/uploads/1791231885644-logo.png" alt="RHMS logo" className="login-brand-logo" />
          )}
          <div className="login-brand-text">
            <span className="login-brand-name">{systemName || 'RHMS Support System'}</span>
            <span className="login-brand-sub">Request Handling Management System</span>
          </div>
        </div>
        <h2 className="login-title">{t('common.login')}</h2>
        <p className="login-subtitle">{t('common.welcomeSubtitle')}</p>

        {error && <div className="login-error">{error}</div>}
        {notice && <div style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{notice}</div>}

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
                title={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
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
                  <div className="otp-boxes" onPaste={handleOtpPaste}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[i] || ''}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={`otp-box${errors.otp ? ' input-error' : ''}${otp[i] ? ' otp-filled' : ''}`}
                        aria-label={`Digit ${i + 1}`}
                        required={i === 0}
                      />
                    ))}
                  </div>
                  <ValidationError message={errors.otp} />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                    <button type="button" className="btn btn-outline" onClick={closeForgot}>{t('common.cancel')}</button>
                    {resendSeconds > 0 ? (
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                        Resend in {resendSeconds}s
                      </span>
                    ) : (
                      <button type="button" className="forgot-link" onClick={(e) => handleSendOtp(e, true)} disabled={forgotLoading}>
                        {t('common.resendCode')}
                      </button>
                    )}
                  </div>
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
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" className="btn btn-outline" onClick={closeForgot}>{t('common.cancel')}</button>
                  <button type="submit" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }} disabled={forgotLoading}>
                    {forgotLoading ? t('common.signingIn') : t('common.resetPasswordBtn')}
                  </button>
                </div>
              </form>
            )}
            {forgotStep === 'done' && (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="login-btn" style={{ width: 'auto', padding: '10px 24px' }} onClick={backToLogin}>
                  {t('common.signIn')}
                </button>
              </div>
            )}
            {/* 'done' is unreachable: successful resets close the modal and
                surface the success notice on the Login page itself. */}
          </div>
        </div>
      )}
    </div>
  );
}
