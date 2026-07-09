import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => { api.get('/api/settings').then(setSettings); }, []);

  if (!settings) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>System Settings</h1><p>Configure system-wide settings</p></div></div>
      <div className="settings-grid">
        <div className="settings-card">
          <h3>General</h3>
          <div className="form-group"><label>Company Name</label><input type="text" defaultValue={settings.companyName} /></div>
          <div className="form-group"><label>Support Email</label><input type="email" defaultValue={settings.supportEmail} /></div>
          <div className="form-group"><label>Request Prefix</label><input type="text" defaultValue={settings.requestPrefix} /></div>
        </div>
        <div className="settings-card">
          <h3>File Upload</h3>
          <div className="form-group"><label>Max File Size</label><input type="text" defaultValue={settings.maxFileSize} /></div>
          <div className="form-group">
            <label>Allowed File Types</label>
            <div className="tags">{settings.allowedFileTypes.map(t => <span key={t} className="tag">.{t}</span>)}</div>
          </div>
        </div>
        <div className="settings-card">
          <h3>Notifications</h3>
          <div className="toggle-row">
            <span>Email Notifications</span>
            <label className="toggle"><input type="checkbox" defaultChecked={settings.emailNotifications} /><span className="slider"></span></label>
          </div>
          <div className="toggle-row">
            <span>Auto-assign Requests</span>
            <label className="toggle"><input type="checkbox" defaultChecked={settings.autoAssign} /><span className="slider"></span></label>
          </div>
        </div>
        <div className="settings-card">
          <h3>SLA</h3>
          <div className="form-group"><label>SLA Hours</label><input type="number" defaultValue={settings.slaHours} /></div>
        </div>
      </div>
    </div>
  );
}
