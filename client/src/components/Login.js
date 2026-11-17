import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { validateEmail } from '../utils/validation';
import ValidationError from './ValidationError';
import { useTranslation } from '../i18n/useTranslation';
import LanguageSelector from './LanguageSelector';
import Icon from './Icon';
import { api, API_BASE } from '../api';

function LoginIllustration() {
  return (
    <svg className="login-illustration-svg" viewBox="0 0 920 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="lhOrbit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#8FE9FF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0869C7" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="lhLaptopFrame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1D4373" />
          <stop offset="55%" stopColor="#0C2241" />
          <stop offset="100%" stopColor="#06152B" />
        </linearGradient>
        <linearGradient id="lhScreenFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10549A" />
          <stop offset="55%" stopColor="#093A72" />
          <stop offset="100%" stopColor="#071F45" />
        </linearGradient>
        <linearGradient id="lhBaseFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#174577" />
          <stop offset="48%" stopColor="#0C2A52" />
          <stop offset="100%" stopColor="#061830" />
        </linearGradient>
        <linearGradient id="lhGlassFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F2FCFF" stopOpacity="0.94" />
          <stop offset="45%" stopColor="#C3EDFF" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#71C9F6" stopOpacity="0.68" />
        </linearGradient>
        <filter id="lhSoftGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse cx="255" cy="432" rx="240" ry="34" fill="#0B6FC7" opacity="0.14" filter="url(#lhSoftGlow)" />

      <g fill="none" filter="url(#lhSoftGlow)">
        <ellipse cx="610" cy="232" rx="268" ry="76" transform="rotate(-16 610 232)" stroke="url(#lhOrbit)" strokeWidth="2.2" />
        <ellipse cx="610" cy="232" rx="252" ry="58" transform="rotate(13 610 232)" stroke="#90EBFF" strokeOpacity="0.62" strokeWidth="1.5" />
        <ellipse cx="610" cy="232" rx="86" ry="222" transform="rotate(24 610 232)" stroke="url(#lhOrbit)" strokeOpacity="0.55" strokeWidth="1.3" />
        <circle cx="610" cy="232" r="224" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />
      </g>

      <g filter="url(#lhSoftGlow)">
        <circle cx="352" cy="144" r="3.6" fill="#FFFFFF" />
        <circle cx="872" cy="256" r="3" fill="#8FE9FF" />
        <circle cx="810" cy="382" r="2.6" fill="#FFFFFF" />
        <circle cx="552" cy="400" r="2.6" fill="#8FE9FF" />
        <circle cx="404" cy="212" r="2.4" fill="#8FE9FF" />
      </g>

      <g transform="translate(243 300) scale(1.10) translate(-243 -300)">
      <g transform="skewY(-10)">
        <rect x="102" y="180" width="266" height="204" rx="9" fill="url(#lhLaptopFrame)" stroke="#4A8DCC" strokeOpacity="0.7" strokeWidth="1.5" />
        <rect x="110" y="188" width="250" height="188" rx="4" fill="url(#lhScreenFill)" />
        <path d="M110 192 A4 4 0 0 1 114 188 H356 A4 4 0 0 1 360 192 V206 H110 Z" fill="#0B2B55" />
        <circle cx="124" cy="197" r="2.6" fill="#FF6B6B" />
        <circle cx="134" cy="197" r="2.6" fill="#F5A000" />
        <circle cx="144" cy="197" r="2.6" fill="#3ED598" />
        <rect x="184" y="193" width="96" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.1" />
        <rect x="132" y="216" width="206" height="132" rx="12" fill="#FFFFFF" fillOpacity="0.11" stroke="#A7E8FF" strokeOpacity="0.5" />
        <g transform="translate(158 230)">
          <path d="M5 26 V18 a15 15 0 0 1 30 0 v8" stroke="#8FE9FF" strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x="0" y="20" width="9" height="15" rx="4.5" fill="#0B7FD4" />
          <rect x="31" y="20" width="9" height="15" rx="4.5" fill="#0B7FD4" />
          <path d="M35 35 v4 a6 6 0 0 1 -6 6 h-5" stroke="#8FE9FF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="20" cy="46" r="2.6" fill="#F5A000" />
        </g>
        <rect x="210" y="234" width="106" height="8" rx="4" fill="#F1FCFF" fillOpacity="0.9" />
        <rect x="210" y="250" width="84" height="6" rx="3" fill="#A7E8FF" fillOpacity="0.6" />
        <rect x="210" y="264" width="98" height="6" rx="3" fill="#A7E8FF" fillOpacity="0.42" />
        <circle cx="142" cy="316" r="6" fill="#3ED598" />
        <circle cx="160" cy="316" r="6" fill="#08B7D8" />
        <circle cx="178" cy="316" r="6" fill="#F5A000" />
        <rect x="196" y="312" width="120" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.18" />
      </g>
      <path d="M102 366 L368 319 L428 366 L58 417 Z" fill="url(#lhBaseFill)" stroke="#5296D6" strokeOpacity="0.6" strokeWidth="1.5" />
      <path d="M124 370 L352 331 L392 366 L104 401 Z" fill="#071B34" stroke="#2D6FB4" strokeOpacity="0.5" />
      <path d="M132 377 L344 341 M126 385 L356 347 M118 393 L368 353" stroke="#2E86D6" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="8 5" />
      <path d="M160 374 L140 397 M200 367 L180 390 M240 360 L220 383 M280 353 L260 376 M320 346 L300 369" stroke="#2E86D6" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M206 397 L286 384 L302 397 L222 410 Z" fill="#2A6FB6" fillOpacity="0.4" stroke="#6CC6FF" strokeOpacity="0.55" />
      <path d="M102 366 L368 319" stroke="#7AE1FF" strokeWidth="3" strokeOpacity="0.85" filter="url(#lhSoftGlow)" />
      <path d="M58 417 L428 366" stroke="#2FA8E8" strokeWidth="2" strokeOpacity="0.55" />
      </g>

      <g filter="url(#lhSoftGlow)">
        <path d="M330 214 C380 184 420 170 460 168" stroke="#08B7D8" strokeWidth="2" strokeOpacity="0.6" fill="none" />
        <path d="M520 202 C550 190 578 196 604 210" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.55" fill="none" />
      </g>

      <g transform="rotate(-8 478 170)">
        <rect x="402" y="118" width="152" height="104" rx="14" fill="url(#lhGlassFill)" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.6" />
        <rect x="402" y="118" width="152" height="104" rx="14" fill="none" stroke="#08B7D8" strokeOpacity="0.5" strokeWidth="1" />
        <circle cx="432" cy="150" r="15" fill="#0B7FD4" />
        <path d="M425 153 v-4 a7 7 0 0 1 14 0 v4" stroke="#EEFCFF" strokeWidth="2.2" fill="none" />
        <rect x="424" y="150" width="3.5" height="8" rx="1.7" fill="#EEFCFF" />
        <rect x="437" y="150" width="3.5" height="8" rx="1.7" fill="#EEFCFF" />
        <rect x="457" y="138" width="78" height="7" rx="3.5" fill="#0B63B4" fillOpacity="0.85" />
        <rect x="457" y="152" width="62" height="6" rx="3" fill="#0B8FD4" fillOpacity="0.55" />
        <rect x="418" y="182" width="118" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.75" />
        <rect x="418" y="196" width="88" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.5" />
      </g>

      <g transform="rotate(7 502 330)">
        <rect x="452" y="258" width="104" height="146" rx="14" fill="url(#lhGlassFill)" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.5" />
        <circle cx="476" cy="290" r="11" fill="#0869C7" />
        <path d="M471 290 l4 4 l7 -8" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="495" y="287" width="46" height="6" rx="3" fill="#0B63B4" fillOpacity="0.8" />
        <rect x="495" y="297" width="34" height="4" rx="2" fill="#0B8FD4" fillOpacity="0.5" />
        <circle cx="476" cy="332" r="11" fill="#08B7D8" />
        <path d="M471 332 l4 4 l7 -8" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="495" y="329" width="46" height="6" rx="3" fill="#0B63B4" fillOpacity="0.8" />
        <rect x="495" y="339" width="34" height="4" rx="2" fill="#0B8FD4" fillOpacity="0.5" />
        <circle cx="476" cy="374" r="11" fill="#F5A000" />
        <path d="M471 374 l4 4 l7 -8" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="495" y="371" width="46" height="6" rx="3" fill="#0B63B4" fillOpacity="0.8" />
        <rect x="495" y="381" width="34" height="4" rx="2" fill="#0B8FD4" fillOpacity="0.5" />
      </g>
    </svg>
  );
}

export default function Login() {
  const { t, language } = useTranslation();
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
  const { login, googleLogin, systemName, systemLogo, darkMode, toggleDarkMode } = useAuth();
  const appName = t('general.appName');
  const displaySystemName = language === 'am' ? t('loginPage.systemName', { appName }) : (systemName || t('loginPage.systemName', { appName }));
  const logoUrl = systemLogo ? `${API_BASE}${systemLogo}` : `${API_BASE}/uploads/1791231885644-logo.png`;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(!process.env.REACT_APP_GOOGLE_CLIENT_ID);
  const navigate = useNavigate();
  const location = useLocation();
  const otpRefs = useRef([]);
  useEffect(() => {
    if (location.state && location.state.email) {
      setUsernameOrEmail(location.state.email);
    }
  }, [location.state]);
  const [resendSeconds, setResendSeconds] = useState(0);

  
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendSeconds]);

  
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

  
  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGoogleUnavailable(true);
      return;
    }

    let cancelled = false;
    let timeoutId;

    const fail = () => {
      if (cancelled) return;
      console.warn('[RHMS] Google sign-in is unavailable (the Google Identity script could not be loaded).');
      setGoogleUnavailable(true);
    };

    const init = () => {
      if (cancelled) return;
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        fail();
        return;
      }
      clearTimeout(timeoutId);
      setGoogleUnavailable(false);
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async (response) => {
          setGoogleLoading(true);
          setError('');
          try {
            const user = await googleLogin(response.credential);
            if (user.role === 'client') navigate('/client');
            else navigate('/');
          } catch (err) {
            const msg = err.message || '';
            if (msg.includes('No RHMS account') || msg.includes('not found')) {
              setError('No RHMS account found for this Google account. Please sign up first.');
            } else if (msg.includes('blocked')) setError('Your account is blocked. Please contact the administrator.');
            else setError(msg || t('common.googleSignInFailed'));
          } finally {
            setGoogleLoading(false);
          }
        },
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
      });
      const container = document.getElementById('rhms-google-btn');
      if (container && !container.hasChildNodes()) {
        window.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 360,
        });
      }
    };

    if (window.google && window.google.accounts && window.google.accounts.id) {
      init();
      return () => { cancelled = true; clearTimeout(timeoutId); };
    }
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      if (existing.dataset.failed === 'true') {
        fail();
      } else {
        existing.addEventListener('load', init);
        existing.addEventListener('error', fail);
      }
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
        existing.removeEventListener('load', init);
        existing.removeEventListener('error', fail);
      };
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      init();
    };
    script.onerror = () => {
      script.dataset.failed = 'true';
      fail();
    };
    document.head.appendChild(script);
    timeoutId = setTimeout(() => {
      if (!(window.google && window.google.accounts && window.google.accounts.id)) fail();
    }, 10000);

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [googleLogin, navigate, t]);

  const handleGoogleSignIn = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId || googleUnavailable) {
      setError(t('common.googleSignInFailed'));
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setError(t('common.googleSignInFailed'));
      return;
    }
    setGoogleLoading(true);
    setError('');
    
    
    const container = document.getElementById('rhms-google-btn');
    const renderedBtn = container ? container.querySelector('div[role="button"]') : null;
    if (renderedBtn) {
      try {
        renderedBtn.click();
        return;
      } catch (e) {
        
      }
    }
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification && (notification.isNotDisplayed() || notification.isSkippedMoment())) {
          const btn = container ? container.querySelector('div[role="button"]') : null;
          if (btn) btn.click();
          else setGoogleLoading(false);
        }
      });
    } catch (e) {
      setGoogleLoading(false);
      setError(t('common.googleSignInFailed'));
    }
  };

  const validateField = (name, value) => {
    let err = '';
    if (name === 'forgotEmail') err = validateEmail(value);
    else if (name === 'usernameOrEmail') {
      if (value.includes('@')) err = validateEmail(value);
      else if (!value.trim()) err = t('loginPage.required');
    }
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
        setError(t('loginPage.accountBlocked'));
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

  
  const handleSendOtp = async (e, isResend = false) => {
    if (e) e.preventDefault();
    if (forgotLoading) return; 
    const targetEmail = forgotEmail;
    const err = validateField('forgotEmail', targetEmail);
    if (err) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');
    try {
      const data = await api.post('/api/auth/forgot-password-otp', { email: targetEmail });
      
      
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

  
  
  const handleOtpChange = (index, value) => {
    const clean = value.replace(/\D/g, '');
    const digits = otp.padEnd(6, ' ').split('').slice(0, 6);
    if (!clean) {
      digits[index] = ' ';
      setOtp(digits.join('').replace(/ /g, ''));
      setErrors(prev => ({ ...prev, otp: '' }));
      return;
    }
    
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
      
      
      const resetEmail = forgotEmail;
      closeForgot();
      setUsernameOrEmail(resetEmail);
      setNotice(t('common.passwordResetSuccess'));
    } catch (err) {
      const msg = err.message || '';
      
      
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
    <div className="login-page" id="rhms-login-page">
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-glow"></div>
        <div className="login-wave login-wave-1"></div>
        <div className="login-wave login-wave-2"></div>
        <div className="login-wave login-wave-3"></div>
        <div className="login-wave login-wave-4"></div>
        <div className="login-dots login-dots-tl"></div>
        <div className="login-dots login-dots-bl"></div>
        <svg className="login-world-dots" viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lhWorldDot" width="9" height="9" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#3E8FD0" />
            </pattern>
          </defs>
          <path d="M60 60 L130 45 L165 70 L150 105 L115 120 L100 150 L75 130 L65 95 Z" fill="url(#lhWorldDot)" />
          <path d="M135 160 L170 150 L185 185 L170 235 L150 260 L138 220 Z" fill="url(#lhWorldDot)" />
          <path d="M275 55 L320 50 L330 75 L300 90 L275 80 Z" fill="url(#lhWorldDot)" />
          <path d="M285 110 L340 105 L350 150 L325 205 L295 185 L280 140 Z" fill="url(#lhWorldDot)" />
          <path d="M340 50 L460 45 L500 75 L470 110 L420 120 L385 100 L350 95 Z" fill="url(#lhWorldDot)" />
          <path d="M470 175 L520 170 L535 205 L500 220 L475 205 Z" fill="url(#lhWorldDot)" />
        </svg>
        <div className="login-spark login-spark-1"></div>
        <div className="login-spark login-spark-2"></div>
        <div className="login-spark login-spark-3"></div>
        <div className="login-spark login-spark-4"></div>
        <div className="login-network" aria-hidden="true">
          <svg viewBox="0 0 520 720" preserveAspectRatio="xMaxYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="loginTechGrid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#9FD6FF" strokeWidth="0.6" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#loginTechGrid)" opacity="0.45" />
          </svg>
        </div>
      </div>

      <div className="login-showcase" aria-hidden="true">
        <div className="login-showcase-brand">
          <img src={logoUrl} alt="" className="login-showcase-logo" />
          <div className="login-showcase-brand-text">
            <div className="login-showcase-title">{displaySystemName}</div>
            <div className="login-showcase-subtitle">{t('loginPage.subtitle')}</div>
          </div>
        </div>

        <div className="login-showcase-copy">
            <div className="login-headline-text">
              <em>{t('loginPage.headlineW1')}</em>{' '}{t('loginPage.headlineW2')}{t('loginPage.headlinePeriod')}{' '}<em>{t('loginPage.headlineW3')}</em>{' '}{t('loginPage.headlineW4')}{t('loginPage.headlinePeriod')}<br />
              <em>{t('loginPage.headlineW5')}</em>{' '}{t('loginPage.headlineW6')}{t('loginPage.headlinePeriod')}
            </div>
            <div className="login-headline-divider"></div>
            <p className="login-showcase-description">
              {t('loginPage.desc1', { appName })}<br />
              {t('loginPage.desc2')}<br />
              {t('loginPage.desc3')}
            </p>

          <div className="login-showcase-features">
          <div className="login-feature">
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-8 20 20)">
                <path d="M7 10 H33 A3 3 0 0 1 36 13 V16 A3 3 0 0 0 36 22 V25 A3 3 0 0 1 33 28 H7 A3 3 0 0 1 4 25 V22 A3 3 0 0 0 4 16 V13 A3 3 0 0 1 7 10 Z" fill="none" stroke="#0869C7" strokeWidth="2.4" />
                <path d="M14 19 H26" stroke="#0869C7" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
              </g>
            </svg>
            <div className="login-feature-label">{t('loginPage.featureSubmit1')}<br />{t('loginPage.featureSubmit2')}</div>
          </div>
          <div className="login-feature">
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="12" r="6" fill="#0869C7" />
              <path d="M8 31 A12 12 0 0 1 32 31 Z" fill="#0869C7" />
              <circle cx="7" cy="16" r="4" fill="#0869C7" />
              <circle cx="33" cy="16" r="4" fill="#0869C7" />
            </svg>
            <div className="login-feature-label">{t('loginPage.featureTrack1')}<br />{t('loginPage.featureTrack2')}</div>
          </div>
          <div className="login-feature">
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="15" fill="#0869C7" />
              <path d="M13 20 l5 5 l10 -11" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="login-feature-label">{t('loginPage.featureGet1')}<br />{t('loginPage.featureGet2')}</div>
          </div>
          </div>

          <div className="login-showcase-illustration">
            <LoginIllustration />
          </div>
        </div>
      </div>

      <div className="login-top-controls">
        <button
          type="button"
          className="login-theme-toggle"
          onClick={toggleDarkMode}
          title={darkMode ? t('topbar.switchToLight') : t('topbar.switchToDark')}
          aria-label={darkMode ? t('topbar.switchToLight') : t('topbar.switchToDark')}
        >
          <span className="login-theme-toggle-icon"><Icon name={darkMode ? 'sun' : 'moon'} size={16} /></span>
          <span>{darkMode ? t('common.brightMode') : t('common.darkMode')}</span>
        </button>
        <LanguageSelector variant="login" />
      </div>

      <div className="login-card">
        <div className="login-brand-header">
          <img src={logoUrl} alt={displaySystemName} className="login-brand-logo" />
          <div className="login-brand-text">
            <span className="login-brand-name">{displaySystemName}</span>
            <span className="login-brand-sub">{t('loginPage.subtitle')}</span>
          </div>
        </div>
        <h2 className="login-title">{t('common.login')}</h2>
        <p className="login-subtitle">{t('common.welcomeSubtitle')}</p>

        {error && <div className="login-error">{error}</div>}
        {notice && <div className="login-inline-notice" style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{notice}</div>}

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
                placeholder={t('loginPage.usernamePlaceholder')}
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
                placeholder="••••••••"
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

        {!googleUnavailable && (
          <>
            <div className="login-divider"><span>{t('common.or')}</span></div>
            <div className="google-btn-wrapper" aria-busy={googleLoading} style={{ position: 'relative' }}>
              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                aria-label={t('common.googleContinue')}
              >
                <span className="google-btn-icon">
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.57a14.5 14.5 0 0 1 0-9.14l-7.98-6.19a24.0 24.0 0 0 0 0 21.52l7.98-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                </span>
                <span className="google-btn-text">{googleLoading ? t('common.googleSignIn') : t('common.googleContinue')}</span>
              </button>
              <div id="rhms-google-btn" style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden', zIndex: 2, pointerEvents: 'auto' }} />
            </div>
          </>
        )}

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
            {forgotMsg && <div className="login-inline-notice" style={{ background: '#F0FDF4', color: '#15803D', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{forgotMsg}</div>}
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
                        aria-label={t('loginPage.digit', { number: i + 1 })}
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
                      <span style={{ fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                        {t('loginPage.resendIn', { seconds: resendSeconds })}
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
            {}
          </div>
        </div>
      )}
    </div>
  );
}