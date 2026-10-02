import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { validateName, validateEmail } from '../utils/validation';
import ValidationError from './ValidationError';
import { useTranslation } from '../i18n/useTranslation';
import LanguageSelector from './LanguageSelector';

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
  const [errors, setErrors] = useState({ name: '', companyName: '', email: '' });
  const navigate = useNavigate();

  const validateField = (name, value) => {
    let err = '';
    if (name === 'name') err = validateName(value, t('common.fullName'));
    else if (name === 'companyName') err = validateName(value, t('common.companyName'));
    else if (name === 'email') err = validateEmail(value);
    setErrors(prev => ({ ...prev, [name]: err }));
    return err;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const nameErr = validateField('name', name);
    const companyErr = validateField('companyName', companyName);
    const emailErr = validateField('email', email);
    if (nameErr || companyErr || emailErr) return;
    if (!accepted) {
      setError(t('common.mustAcceptTerms'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/signup', { name, email, password, companyName });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
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
        <h2 className="login-title">{t('common.createAccount')}</h2>
        <p className="login-subtitle">{t('common.fillDetails')}</p>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="signup-success">{t('common.accountCreated')}</div>}

        <form onSubmit={handleSubmit}>
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
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
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
              >
                {showPassword ? t('common.hide').toUpperCase() : t('common.show').toUpperCase()}
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
              >
                {showConfirm ? t('common.hide').toUpperCase() : t('common.show').toUpperCase()}
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

        <p className="signup-link">
          {t('common.alreadyHaveAccount')} <button type="button" className="signup-btn" onClick={() => navigate('/login')}>{t('common.signIn')}</button>
        </p>
      </div>
    </div>
  );
}
