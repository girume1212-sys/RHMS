import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function CreateRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ subject: '', description: '', categoryId: '', priorityId: '2' });
  const [categories, setCategories] = useState([]);
  const [prioritiesList, setPriorities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/categories').then(setCategories);
    api.get('/api/priorities').then(setPriorities);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/requests', form);
      navigate('/requests');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Create Request</h1>
          <p>Submit a new support request</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/requests')}>← Back to Requests</button>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>Subject *</label>
            <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of the issue" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category *</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                <option value="">Select a category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priorityId} onChange={(e) => setForm({ ...form, priorityId: e.target.value })}>
                {prioritiesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Provide detailed information about the issue..." rows={8} required />
          </div>
          <div className="form-group">
            <label>Attachments</label>
            <div className="file-upload">
              <input type="file" id="file-upload" multiple style={{ display: 'none' }} />
              <label htmlFor="file-upload" className="file-upload-label">
                📎 Click to upload files or drag and drop
                <span>PDF, DOCX, XLSX, JPG, PNG (Max 10MB)</span>
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => navigate('/requests')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
