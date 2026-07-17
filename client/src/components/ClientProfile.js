import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import Toast from './Toast';
import { showStatusToast } from '../notify';

const API_URL = 'http://localhost:5000';

export default function ClientProfile() {
  const { user, token, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    companyName: user?.companyName || '',
    password: '',
    confirmPassword: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [error, setError] = useState('');

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${API_URL}${avatar}`;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
    setError('');
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setError('');

    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('email', form.email);
      formData.append('companyName', form.companyName);
      if (form.password) {
        formData.append('password', form.password);
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      updateUser(data);
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      setForm({ ...form, password: '', confirmPassword: '' });
      addToast('Profile updated successfully!');
      showStatusToast('Profile updated', 'status');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      companyName: user?.companyName || '',
      password: '',
      confirmPassword: '',
    });
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditing(false);
    setError('');
  };

  const displayAvatar = avatarPreview || getAvatarUrl(user?.avatar);

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>My Profile</h1>
          <p>Manage your account information</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              color: '#fff', border: 'none', padding: '10px 24px',
              borderRadius: '12px', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(59,130,246,0.4)'; }}
            onMouseOut={(e) => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'; }}
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          color: '#fff', padding: '12px 20px', borderRadius: '12px',
          marginBottom: '20px', fontSize: '14px', fontWeight: '500',
          boxShadow: '0 4px 12px rgba(239,68,68,0.3)'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '900px' }}>
        {/* Profile Card */}
        <div style={{
          background: 'linear-gradient(145deg, #3B82F6, #2563EB, #1D4ED8)',
          borderRadius: '20px', padding: '32px', color: '#fff',
          boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
        }}>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
            {editing ? (
              <>
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Avatar"
                    style={{
                      width: '100px', height: '100px', borderRadius: '50%',
                      objectFit: 'cover', border: '4px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }}
                  />
                ) : (
                  <div
                    onClick={() => fileInputRef.current.click()}
                    style={{
                      width: '100px', height: '100px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.15)', border: '4px dashed rgba(255,255,255,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '36px'
                    }}
                  >📷</div>
                )}
                <button
                  onClick={() => fileInputRef.current.click()}
                  style={{
                    position: 'absolute', bottom: 2, right: 2,
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#F59E0B', color: '#fff', border: '3px solid #fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                >📷</button>
                {avatarFile && (
                  <button
                    onClick={handleRemoveAvatar}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: '#EF4444', color: '#fff', border: '3px solid #fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >✕</button>
                )}
              </>
            ) : (
              <>
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Avatar"
                    style={{
                      width: '100px', height: '100px', borderRadius: '50%',
                      objectFit: 'cover', border: '4px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '40px', fontWeight: '700',
                    border: '4px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                  }}>
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
              </>
            )}
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700' }}>
            {editing ? form.name : user?.name}
          </h2>
          <p style={{ margin: '0 0 12px', opacity: 0.8, fontSize: '14px' }}>
            {editing ? form.email : user?.email}
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.2)', padding: '6px 16px',
            borderRadius: '20px', fontSize: '13px', fontWeight: '600',
            backdropFilter: 'blur(10px)'
          }}>
            Client
          </div>
          <div style={{ marginTop: '20px', width: '100%', opacity: 0.9, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <span>Company</span>
              <span style={{ fontWeight: '600' }}>{editing ? (form.companyName || '-') : (user?.companyName || '-')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <span>Role</span>
              <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Member Since</span>
              <span style={{ fontWeight: '600' }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
            </div>
          </div>
        </div>

        {/* Edit Form Card */}
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            margin: '0 0 24px', fontSize: '18px', fontWeight: '600',
            color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '16px'
            }}>✏️</span>
            {editing ? 'Edit Information' : 'Account Details'}
          </h3>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Name Field */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#2563EB', marginBottom: '6px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '6px',
                    background: '#dbeafe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                  }}>👤</span>
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px',
                    border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    background: '#f9fafb', color: '#1f2937', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3B82F6'; e.target.style.background = '#eff6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                />
                <span style={{ position: 'absolute', left: '14px', top: '38px', fontSize: '16px', pointerEvents: 'none' }}>👤</span>
              </div>

              {/* Email Field */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#0284c7', marginBottom: '6px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '6px',
                    background: '#e0f2fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                  }}>📧</span>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px',
                    border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    background: '#f9fafb', color: '#1f2937', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#0ea5e9'; e.target.style.background = '#f0f9ff'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                />
                <span style={{ position: 'absolute', left: '14px', top: '38px', fontSize: '16px', pointerEvents: 'none' }}>📧</span>
              </div>

              {/* Company Field */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#1e40af', marginBottom: '6px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '6px',
                    background: '#dbeafe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                  }}>🏢</span>
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Enter company name"
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px',
                    border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    background: '#f9fafb', color: '#1f2937', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#1e40af'; e.target.style.background = '#eff6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                />
                <span style={{ position: 'absolute', left: '14px', top: '38px', fontSize: '16px', pointerEvents: 'none' }}>🏢</span>
              </div>

              {/* Password Field */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#3730a3', marginBottom: '6px' }}>
                  <span style={{
                    width: '22px', height: '22px', borderRadius: '6px',
                    background: '#e0e7ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                  }}>🔒</span>
                  New Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Leave blank to keep current"
                  minLength={6}
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px',
                    border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    background: '#f9fafb', color: '#1f2937', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3730a3'; e.target.style.background = '#eef2ff'; e.target.style.boxShadow = '0 0 0 3px rgba(55,48,163,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                />
                <span style={{ position: 'absolute', left: '14px', top: '38px', fontSize: '16px', pointerEvents: 'none' }}>🔒</span>
              </div>

              {/* Confirm Password Field */}
              {form.password && (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px' }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '6px',
                      background: '#dbeafe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                    }}>🔐</span>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm new password"
                    minLength={6}
                    style={{
                      width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px',
                      border: '2px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                      background: '#f9fafb', color: '#1f2937', transition: 'all 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#1d4ed8'; e.target.style.background = '#eff6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb'; e.target.style.boxShadow = 'none'; }}
                  />
                  <span style={{ position: 'absolute', left: '14px', top: '38px', fontSize: '16px', pointerEvents: 'none' }}>🔐</span>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleCancel}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)', color: '#6b7280',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                    transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => { e.target.style.borderColor = '#EF4444'; e.target.style.color = '#EF4444'; e.target.style.background = '#fef2f2'; }}
                  onMouseOut={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.color = '#6b7280'; e.target.style.background = 'linear-gradient(135deg, #f9fafb, #f3f4f6)'; }}
                >Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: 'none',
                    background: loading ? 'linear-gradient(135deg, #93c5fd, #60a5fa)' : 'linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)',
                    color: '#fff',
                    fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? '0 4px 12px rgba(96,165,250,0.3)' : '0 4px 16px rgba(59,130,246,0.4)',
                    transition: 'all 0.2s', letterSpacing: '0.3px'
                  }}
                  onMouseOver={(e) => { if (!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(59,130,246,0.5)'; }}}
                  onMouseOut={(e) => { e.target.style.transform = 'none'; e.target.style.boxShadow = loading ? '0 4px 12px rgba(96,165,250,0.3)' : '0 4px 16px rgba(59,130,246,0.4)'; }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { label: 'Full Name', value: user?.name, icon: '👤', color: '#2563EB' },
                { label: 'Email', value: user?.email, icon: '📧', color: '#0284c7' },
                { label: 'Company', value: user?.companyName || '-', icon: '🏢', color: '#1e40af' },
                { label: 'Role', value: user?.role, icon: '🛡️', color: '#3730a3', capitalize: true },
                { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-', icon: '📅', color: '#1d4ed8' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 0',
                  borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none'
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: item.color + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{
                      fontSize: '14px', fontWeight: '500', color: '#1f2937',
                      textTransform: item.capitalize ? 'capitalize' : 'none'
                    }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
