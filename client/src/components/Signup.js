import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { validateName, validateEmail } from '../utils/validation';
import ValidationError from './ValidationError';
import { useTranslation } from '../i18n/useTranslation';
import LanguageSelector from './LanguageSelector';
import Icon from './Icon';

export default function Signup() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({ name: '', companyName: '', email: '', code: '' });
  // Email-verification step (UI only): 'details' -> 'verify'. No account exists until verified.
  const [step, setStep] = useState('details');
  const [code, setCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const codeRefs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSeconds]);

  const validateField = (name, value) => {
    let err = '';
    if (name === 'name') err = validateName(value, t('common.fullName'));
    else if (name === 'companyName') err = validateName(value, t('common.companyName'));
    else if (name === 'email') err = validateEmail(value);
    setErrors(prev => ({ ...prev, [name]: err }));
    return err;
  };

  // Step 1: validate details + mail a verification code (creates no account).
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    const nameErr = validateField('name', name);
    const companyErr = validateField('companyName', companyName);
    const emailErr = validateField('email', email);
    if (nameErr || companyErr || emailErr) return;
    if (password !== confirmPassword) {
      setError(t('validation.passwordMismatch'));
      return;
    }
    if (!accepted) {
      setError(t('common.mustAcceptTerms'));
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/api/auth/request-email-verification', { name, email, password, companyName });
      setStep('verify');
      setCode('');
      setResendSeconds(data.retryAfter || 60);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/auth/request-email-verification', { name, email, password, companyName });
      setCode('');
      setResendSeconds(data.retryAfter || 60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    const digits = code.padEnd(6, ' ').split('').slice(0, 6);
    if (!clean) {
      digits[index] = ' ';
      setCode(digits.join('').replace(/ /g, ''));
      setErrors(prev => ({ ...prev, code: '' }));
      return;
    }
    const chars = clean.slice(0, 6 - index).split('');
    chars.forEach((ch, k) => { digits[index + k] = ch; });
    setCode(digits.join('').replace(/ /g, '').slice(0, 6));
    setErrors(prev => ({ ...prev, code: '' }));
    const next = Math.min(index + chars.length, 5);
    codeRefs.current[next]?.focus();
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const digits = code.padEnd(6, ' ').split('').slice(0, 6);
      if (digits[index] !== ' ') {
        digits[index] = ' ';
      } else if (index > 0) {
        digits[index - 1] = ' ';
        codeRefs.current[index - 1]?.focus();
      }
      setCode(digits.join('').replace(/ /g, ''));
      setErrors(prev => ({ ...prev, code: '' }));
    } else if (e.key === 'ArrowLeft' && index > 0) {
      codeRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setCode(pasted);
    setErrors(prev => ({ ...prev, code: '' }));
    const focusIndex = Math.min(pasted.length, 5);
    codeRefs.current[focusIndex]?.focus();
  };

  // Step 2: create the account with the code. /api/auth/signup verifies the
  // code itself (same checks), so no separate pre-verification round-trip.
  const handleVerifyAndSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setErrors(prev => ({ ...prev, code: t('common.otpMustBe6Digits') }));
      return;
    }
    setErrors(prev => ({ ...prev, code: '' }));
    setLoading(true);
    try {
      await api.post('/api/auth/signup', { name, email, password, companyName, code: code.trim() });
      navigate('/login');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('expired')) setError(t('common.otpExpired'));
      else if (msg.includes('Too many incorrect attempts')) setError(t('common.otpLocked'));
      else if (msg.includes('verification failed')) setError(t('common.invalidOtp'));
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-orbs">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
      </div>

      <LanguageSelector variant="login" />

      <div className="login-card signup-card">
        <h2 className="login-title">{step === 'verify' ? t('common.verifyEmailTitle') : t('common.createAccount')}</h2>
        <p className="login-subtitle">{step === 'verify' ? t('common.verificationCodeSent') : t('common.fillDetails')}</p>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="signup-success">{t('common.accountCreated')}</div>}

        {step === 'details' && (
        <form onSubmit={handleRequestCode}>
          <div className="login-field">
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); validateField('name', e.target.value); }}
                placeholder={t('common.enterYourName')}
                className={errors.name ? 'input-error' : ''}
                required
              />
            </div>
            <ValidationError message={errors.name} />
          </div>

          <div className="login-field">
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <input
                type="text"
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); validateField('companyName', e.target.value); }}
                placeholder={t('common.enterCompanyName')}
                className={errors.companyName ? 'input-error' : ''}
                required
              />
            </div>
            <ValidationError message={errors.companyName} />
          </div>

          <div className="login-field">
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2-2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); validateField('email', e.target.value); }}
                placeholder={t('common.enterEmail')}
                className={errors.email ? 'input-error' : ''}
                required
              />
            </div>
            <ValidationError message={errors.email} />
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
                placeholder={t('common.enterPassword')}
                required
                minLength={6}
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

          <div className="login-field">
            <div className="login-input-wrapper">
              <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('common.enterConfirmPassword')}
                required
                minLength={6}
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                title={showConfirm ? t('common.hidePassword') : t('common.showPassword')}
                aria-label={showConfirm ? t('common.hidePassword') : t('common.showPassword')}
              >
                <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </div>

          <div className="login-options" style={{ justifyContent: 'flex-start', marginBottom: '24px' }}>
            <label className="remember-me">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>{t('common.acceptTerms')} <span className="terms-link">{t('common.termsAndConditions')}</span></span>
            </label>
          </div>

          <button type="submit" className="login-btn" disabled={loading || success}>
            {loading ? t('common.creatingAccount') : t('common.createAccount')}
          </button>
        </form>
        )}

        {step === 'verify' && (
        <form onSubmit={handleVerifyAndSignup}>
          <div className="login-field">
            <div className="otp-boxes" onPaste={handleCodePaste}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={code[i] || ''}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className={`otp-box${errors.code ? ' input-error' : ''}${code[i] ? ' otp-filled' : ''}`}
                  aria-label={`Digit ${i + 1}`}
                  required={i === 0}
                />
              ))}
            </div>
            <ValidationError message={errors.code} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <button type="button" className="forgot-link" onClick={() => { setStep('details'); setError(''); }}>
              {t('common.backToDetails')}
            </button>
            {resendSeconds > 0 ? (
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                Resend in {resendSeconds}s
              </span>
            ) : (
              <button type="button" className="forgot-link" onClick={handleResend} disabled={loading}>
                {t('common.resendCode')}
              </button>
            )}
          </div>
          <button type="submit" className="login-btn" disabled={loading || success}>
            {loading ? t('common.creatingAccount') : t('common.verifyCode')}
          </button>
        </form>
        )}

        <p className="signup-link">
          {t('common.alreadyHaveAccount')} <button type="button" className="signup-btn" onClick={() => navigate('/login')}>{t('common.signIn')}</button>
        </p>
      </div>
    </div>
  );
}
