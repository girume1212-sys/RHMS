import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prioritiesList, setPriorities] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadRequest();
    api.get('/api/statuses').then(setStatuses);
    api.get('/api/users').then(setUsers);
    api.get('/api/categories').then(setCategories);
    api.get('/api/priorities').then(setPriorities);
  }, [id]);

  const loadRequest = () => {
    api.get(`/api/requests/${id}`).then(data => {
      setRequest(data);
      setEditForm({ subject: data.subject, description: data.description, categoryId: data.categoryId, priorityId: data.priorityId, statusId: data.statusId, assignedTo: data.assignedTo || '' });
      setLoading(false);
    });
  };

  const handleStatusChange = async (statusId) => {
    await api.put(`/api/requests/${id}`, { statusId });
    loadRequest();
  };

  const handleAssign = async (assignedTo) => {
    await api.put(`/api/requests/${id}`, { assignedTo });
    loadRequest();
  };

  const handleSave = async () => {
    await api.put(`/api/requests/${id}`, editForm);
    setEditing(false);
    loadRequest();
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    await api.post(`/api/requests/${id}/comments`, { content: comment });
    setComment('');
    setSubmitting(false);
    loadRequest();
  };

  const getStatusColor = (status) => {
    const colors = { Open: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!request) return <div className="empty-state">Request not found</div>;

  const canEdit = user.role !== 'client';
  const developers = users.filter(u => u.role === 'developer');

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => navigate('/requests')}>← Back to Requests</button>
          <h1>Request #{request.id}</h1>
          <p>{request.subject}</p>
        </div>
        <div className="header-actions">
          {canEdit && !editing && (
            <button className="btn btn-outline" onClick={() => setEditing(true)}>✏️ Edit</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-card-header">
              <h3>Request Details</h3>
            </div>
            {editing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Subject</label>
                  <input type="text" value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={6} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select value={editForm.priorityId} onChange={(e) => setEditForm({ ...editForm, priorityId: e.target.value })}>
                      {prioritiesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div className="detail-content">
                <p className="detail-description">{request.description}</p>
              </div>
            )}
          </div>

          <div className="detail-card">
            <h3>Comments ({request.comments?.length || 0})</h3>
            <div className="comments-list">
              {request.comments?.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className="comment-avatar">{c.user?.name?.charAt(0) || 'U'}</div>
                  <div className="comment-body">
                    <div className="comment-header">
                      <strong>{c.user?.name || 'Unknown'}</strong>
                      <span className="comment-time">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{c.content}</p>
                  </div>
                </div>
              ))}
              {(!request.comments || request.comments.length === 0) && (
                <div className="empty-state">No comments yet</div>
              )}
            </div>
            <form onSubmit={handleComment} className="comment-form">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment..." rows={3} />
              <button type="submit" className="btn btn-primary" disabled={submitting || !comment.trim()}>
                {submitting ? 'Sending...' : 'Send Comment'}
              </button>
            </form>
          </div>
        </div>

        <div className="detail-sidebar">
          <div className="detail-card">
            <h3>Information</h3>
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">Status</span>
                <span className="status-badge" style={{ background: getStatusColor(request.status) + '20', color: getStatusColor(request.status) }}>{request.status?.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Priority</span>
                <span className="priority-badge" style={{ background: getPriorityColor(request.priority) + '20', color: getPriorityColor(request.priority) }}>{request.priority?.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Category</span>
                <span>{request.category?.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Client</span>
                <span>{request.client?.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Created</span>
                <span>{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Last Updated</span>
                <span>{new Date(request.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="detail-card">
              <h3>Actions</h3>
              <div className="action-list">
                <div className="action-group">
                  <label>Change Status</label>
                  <select value={request.statusId} onChange={(e) => handleStatusChange(e.target.value)}>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="action-group">
                  <label>Assign To</label>
                  <select value={request.assignedTo || ''} onChange={(e) => handleAssign(e.target.value)}>
                    <option value="">Unassigned</option>
                    {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="detail-card">
            <h3>Assignee</h3>
            {request.assignee ? (
              <div className="assignee-info">
                <div className="assignee-avatar-lg" style={{ background: '#3B82F6' }}>{request.assignee.name.charAt(0)}</div>
                <div>
                  <div className="assignee-name">{request.assignee.name}</div>
                  <div className="assignee-role">Developer</div>
                </div>
              </div>
            ) : (
              <p className="unassigned">Not assigned yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
