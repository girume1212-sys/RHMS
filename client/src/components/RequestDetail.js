import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prioritiesList, setPriorities] = useState([]);
  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [editForm, setEditForm] = useState({});
  const [editAttachments, setEditAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const isClient = user?.role === 'client';
  const basePath = isClient ? '/client' : '';

  const addToast = useCallback((message, type = 'success') => {
    const tid = Date.now();
    setToasts(prev => [...prev, { id: tid, message, type }]);
  }, []);

  const removeToast = useCallback((tid) => {
    setToasts(prev => prev.filter(t => t.id !== tid));
  }, []);

  useEffect(() => {
    loadRequest();
    loadActivity();
    api.get('/api/statuses').then(setStatuses);
    if (!isClient) {
      api.get('/api/users').then(setUsers);
    }
    api.get('/api/categories').then(setCategories);
    api.get('/api/priorities').then(setPriorities);
    loadFeedback();
  }, [id]);

  const loadFeedback = () => {
    api.get(`/api/requests/${id}/feedback`).then(data => {
      if (data) {
        setExistingFeedback(data);
        setFeedbackRating(data.rating);
        setFeedbackComment(data.comment || '');
        setFeedbackSubmitted(true);
      }
    }).catch(() => {});
  };

  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) return;
    setFeedbackSubmitting(true);
    try {
      await api.post(`/api/requests/${id}/feedback`, { rating: feedbackRating, comment: feedbackComment });
      setFeedbackSubmitted(true);
      addToast('Feedback submitted successfully! Thank you!');
      showStatusToast('Feedback submitted', 'success');
      loadFeedback();
    } catch (err) {
      addToast('Failed to submit feedback: ' + err.message, 'error');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const loadRequest = () => {
    api.get(`/api/requests/${id}`).then(data => {
      setRequest(data);
      const attachments = data.attachments || [];
      setEditForm({ subject: data.subject, description: data.description, categoryId: data.categoryId, priorityId: data.priorityId, statusId: data.statusId, assignedTo: data.assignedTo || '', attachments });
      setEditAttachments(attachments);
      setLoading(false);
    });
  };

  const loadActivity = () => {
    setLoadingActivity(true);
    api.get(`/api/requests/${id}/activity`).then(data => {
      setActivityLog(data);
      setLoadingActivity(false);
    }).catch(err => {
      console.error('Failed to load activity:', err);
      setActivityLog([]);
      setLoadingActivity(false);
    });
  };

  const handleStatusChange = async (statusId) => {
    try {
      await api.put(`/api/requests/${id}`, { statusId });
      loadRequest();
      loadActivity();
      addToast('Status updated successfully!');
      showStatusToast(`Request #${id} status updated`, 'status', id);
    } catch (err) {
      addToast('Failed to update status: ' + err.message, 'error');
    }
  };

  const handleAssign = async (assignedTo) => {
    try {
      await api.put(`/api/requests/${id}`, { assignedTo });
      loadRequest();
      loadActivity();
      addToast('Assignee updated successfully!');
      showStatusToast(`Request #${id} assignee updated`, 'assignment', id);
    } catch (err) {
      addToast('Failed to update assignee: ' + err.message, 'error');
    }
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setNewFiles(prev => [...prev, ...selected]);
  };

  const removeNewFile = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    const uploaded = [];
    for (const file of newFiles) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('rhms_token')}` },
          body: formData
        });
        const data = await res.json();
        if (data.path) uploaded.push(data.path);
      } catch (err) {
        console.error('Upload failed:', err);
        addToast('File upload failed: ' + err.message, 'error');
      }
    }
    return uploaded;
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let uploadedPaths = [];
      if (newFiles.length > 0) {
        uploadedPaths = await uploadFiles();
      }
      const allAttachments = [...editAttachments, ...uploadedPaths];
      await api.put(`/api/requests/${id}`, { ...editForm, attachments: allAttachments });
      setEditing(false);
      setNewFiles([]);
      loadRequest();
      loadActivity();
      addToast('Request updated successfully!');
      showStatusToast(`Request #${id} updated`, 'status', id);
    } catch (err) {
      console.error('Save failed:', err);
      addToast('Failed to save changes: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadAdditional = async () => {
    if (newFiles.length === 0) return;
    setUploading(true);
    try {
      const uploadedPaths = await uploadFiles();
      if (uploadedPaths.length > 0) {
        const allAttachments = [...(request.attachments || []), ...uploadedPaths];
        await api.put(`/api/requests/${id}`, { attachments: allAttachments });
        setNewFiles([]);
        loadRequest();
        loadActivity();
        addToast('Files uploaded successfully!');
        showStatusToast(`Files uploaded to Request #${id}`, 'status', id);
      }
    } catch (err) {
      addToast('Failed to upload files: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/requests/${id}/comments`, { content: comment });
      setComment('');
      addToast('Comment added successfully!');
      loadRequest();
      loadActivity();
      showStatusToast(`Comment added to Request #${id}`, 'comment', id);
    } catch (err) {
      addToast('Failed to add comment: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444', Rejected: '#DC2626' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const getActivityIcon = (type) => {
    const icons = { created: '📋', status_update: '🔄', assigned: '👤', comment: '💬', updated: '✏️' };
    return icons[type] || '📝';
  };

  const getActivityColor = (type) => {
    const colors = { created: '#3B82F6', status_update: '#F59E0B', assigned: '#8B5CF6', comment: '#10B981', updated: '#6B7280' };
    return colors[type] || '#6B7280';
  };

  const getStatusFlow = () => {
    const lifecycle = ['New', 'Assigned', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'];
    const visitedStatuses = new Set();
    const statusTimestamps = {};

    activityLog.forEach(a => {
      if (a.type === 'status_update') {
        const match = a.message.match(/to\s+(.+)/i);
        if (match) {
          const name = match[1].trim();
          visitedStatuses.add(name);
          if (!statusTimestamps[name]) {
            statusTimestamps[name] = { time: a.createdAt, user: a.user?.name };
          }
        }
      }
    });

    if (request.status) {
      visitedStatuses.add(request.status.name);
      if (!statusTimestamps[request.status.name]) {
        statusTimestamps[request.status.name] = { time: request.createdAt, user: request.client?.name };
      }
    }

    const currentStatus = request.status?.name;
    const currentIdx = lifecycle.indexOf(currentStatus);

    return lifecycle.map((name, idx) => ({
      name,
      color: getStatusColor({ name }),
      visited: visitedStatuses.has(name),
      current: name === currentStatus,
      isPast: currentIdx >= 0 && idx < currentIdx,
      time: statusTimestamps[name]?.time,
      user: statusTimestamps[name]?.user
    }));
  };

  const isImageFile = (path) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(path);
  const getFileName = (path) => path.split('/').pop();

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!request) return <div className="empty-state">Request not found</div>;

  const developers = users.filter(u => u.role === 'developer' || u.role === 'support');
  const attachments = request.attachments || [];

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => navigate(`${basePath}/requests`)}>← Back to Requests</button>
          <h1>Request #{request.id}</h1>
          <p>{request.subject}</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {/* Request Details Card */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3>Request Details</h3>

            </div>
            {editing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Request Title</label>
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
                <div className="form-group">
                  <label>Attachments</label>
                  <div className="attachments-grid">
                    {editAttachments.map((path, i) => (
                      <div key={`existing-${i}`} className="attachment-item">
                        {isImageFile(path) ? (
                          <img src={`${API_BASE}${path}`} alt={getFileName(path)} className="attachment-image" onClick={() => setLightbox(`${API_BASE}${path}`)} />
                        ) : (
                          <a href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer" className="attachment-file">
                            <span className="attachment-file-icon">📄</span>
                            <span>{getFileName(path)}</span>
                          </a>
                        )}
                        <button type="button" className="file-preview-remove" onClick={() => removeExistingAttachment(i)} style={{ position: 'absolute', top: 4, right: 4, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                    {newFiles.map((file, i) => (
                      <div key={`new-${i}`} className="attachment-item" style={{ position: 'relative' }}>
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} className="attachment-image" />
                        ) : (
                          <div className="attachment-file">
                            <span className="attachment-file-icon">📄</span>
                            <span>{file.name}</span>
                          </div>
                        )}
                        <button type="button" className="file-preview-remove" onClick={() => removeNewFile(i)} style={{ position: 'absolute', top: 4, right: 4, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="file-upload" onClick={() => fileInputRef.current.click()} style={{ marginTop: 12 }}>
                    <input type="file" ref={fileInputRef} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                    <div className="file-upload-icon">📤</div>
                    <div className="file-upload-text">Click to upload files</div>
                    <div className="file-upload-hint">Images, PDF, DOCX, XLSX (Max 10MB each)</div>
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn btn-outline" onClick={() => { setEditing(false); setNewFiles([]); loadRequest(); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>
                    {uploading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="detail-content">
                <p className="detail-description">{request.description}</p>
                {attachments.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ marginBottom: 8, fontSize: 14, color: '#6B7280' }}>Attachments ({attachments.length})</h4>
                    <div className="attachments-grid">
                      {attachments.map((path, i) => (
                        <div key={i} className="attachment-item">
                          {isImageFile(path) ? (
                            <img src={`${API_BASE}${path}`} alt={getFileName(path)} className="attachment-image" onClick={() => setLightbox(`${API_BASE}${path}`)} />
                          ) : (
                            <a href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer" className="attachment-file">
                              <span className="attachment-file-icon">📄</span>
                              <span>{getFileName(path)}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Additional Files (Client) */}
          {isClient && !editing && (
            <div className="detail-card">
              <h3>📎 Upload Additional Files</h3>
              <div className="file-upload" onClick={() => fileInputRef.current.click()}>
                <input type="file" ref={fileInputRef} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                <div className="file-upload-icon">📤</div>
                <div className="file-upload-text">Click to upload additional files</div>
                <div className="file-upload-hint">Images, PDF, DOCX, XLSX (Max 10MB each)</div>
              </div>
              {newFiles.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="attachments-grid">
                    {newFiles.map((file, i) => (
                      <div key={`new-${i}`} className="attachment-item" style={{ position: 'relative' }}>
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} className="attachment-image" />
                        ) : (
                          <div className="attachment-file">
                            <span className="attachment-file-icon">📄</span>
                            <span>{file.name}</span>
                          </div>
                        )}
                        <button type="button" className="file-preview-remove" onClick={() => removeNewFile(i)} style={{ position: 'absolute', top: 4, right: 4, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={handleUploadAdditional} disabled={uploading} style={{ marginTop: 12 }}>
                    {uploading ? 'Uploading...' : 'Upload Files'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Timeline / History removed from main - moved to sidebar */}

          {/* Feedback Section (Client, Resolved/Closed only) */}
          {isClient && (request.status?.name === 'Resolved' || request.status?.name === 'Closed') && (
            <div className="feedback-card">
              {existingFeedback && feedbackSubmitted ? (
                <div className="feedback-submitted">
                  <div className="feedback-checkmark">✓</div>
                  <h4 className="feedback-thanks">Thank You for Your Feedback!</h4>
                  <p className="feedback-subtitle">Your rating helps us improve our service.</p>
                  <div className="feedback-stars-display">
                    {[1, 2, 3, 4, 5].map(i => (
                      <svg key={i} className={`feedback-star ${i <= existingFeedback.rating ? 'filled' : ''}`} width="32" height="32" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="feedback-rating-label">
                    {existingFeedback.rating === 1 ? 'Poor' :
                     existingFeedback.rating === 2 ? 'Fair' :
                     existingFeedback.rating === 3 ? 'Good' :
                     existingFeedback.rating === 4 ? 'Very Good' : 'Excellent'}
                    <span className="feedback-rating-num">({existingFeedback.rating}/5)</span>
                  </div>
                  {existingFeedback.comment && (
                    <div className="feedback-comment-display">
                      <div className="feedback-comment-quote">"</div>
                      <p>{existingFeedback.comment}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="feedback-form">
                  <div className="feedback-form-header">
                    <span className="feedback-form-icon">⭐</span>
                    <h3>Rate This Request</h3>
                  </div>
                  <p className="feedback-form-prompt">
                    How would you rate the resolution of this request?
                  </p>
                  <div className="feedback-stars-container">
                    <div className="feedback-stars-row">
                      {[1, 2, 3, 4, 5].map(i => {
                        const active = i <= (hoverRating || feedbackRating);
                        return (
                        <button
                          key={i}
                          type="button"
                          className={`feedback-star-btn ${active ? 'active' : ''}`}
                          onClick={() => setFeedbackRating(i)}
                          onMouseEnter={() => setHoverRating(i)}
                          onMouseLeave={() => setHoverRating(0)}
                          aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
                        >
                          <svg width="40" height="40" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                        );
                      })}
                    </div>
                    <div className="feedback-rating-hint">
                      {(hoverRating || feedbackRating) === 0 ? (
                        <span className="hint-default">Tap a star to rate</span>
                      ) : (
                        <span className={`hint-active rating-${hoverRating || feedbackRating}`}>
                          {(hoverRating || feedbackRating) === 1 && '😞 Poor'}
                          {(hoverRating || feedbackRating) === 2 && '😐 Fair'}
                          {(hoverRating || feedbackRating) === 3 && '🙂 Good'}
                          {(hoverRating || feedbackRating) === 4 && '😊 Very Good'}
                          {(hoverRating || feedbackRating) === 5 && '🤩 Excellent'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="feedback-textarea-group">
                    <label className="feedback-textarea-label">
                      Share more details <span>(optional)</span>
                    </label>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) setFeedbackComment(e.target.value);
                      }}
                      placeholder="What did you like or what could we improve?..."
                      rows={3}
                      className="feedback-textarea"
                    />
                    <div className="feedback-char-count">
                      {feedbackComment.length}/500
                    </div>
                  </div>
                  <button
                    className="feedback-submit-btn"
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackSubmitting || feedbackRating === 0}
                  >
                    {feedbackSubmitting ? (
                      <><span className="feedback-spinner"></span> Submitting...</>
                    ) : (
                      'Submit Feedback'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Comments / Reply */}
          <div className="detail-card">
            <h3>💬 Comments ({request.comments?.length || 0})</h3>
            <div className="comments-list">
              {request.comments?.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className="comment-avatar" style={{ background: c.user?.role === 'client' ? '#7c3aed' : '#3B82F6' }}>
                    {c.user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="comment-body">
                    <div className="comment-header">
                      <strong>{c.user?.name || 'Unknown'}</strong>
                      <span className="comment-role" style={{ 
                        background: c.user?.role === 'client' ? '#7c3aed20' : '#3B82F620',
                        color: c.user?.role === 'client' ? '#7c3aed' : '#3B82F6',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {c.user?.role === 'client' ? 'Client' : c.user?.role === 'admin' ? 'Admin' : c.user?.role === 'support' ? 'Support' : 'Developer'}
                      </span>
                      <span className="comment-time">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p>{c.content}</p>
                  </div>
                </div>
              ))}
              {(!request.comments || request.comments.length === 0) && (
                <div className="empty-state">No comments yet. Be the first to reply!</div>
              )}
            </div>
            <form onSubmit={handleComment} className="comment-form">
              <textarea 
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                placeholder="Write a reply..." 
                rows={3} 
              />
              <button type="submit" className="btn btn-primary" disabled={submitting || !comment.trim()}>
                {submitting ? 'Sending...' : '💬 Send Reply'}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
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
              {attachments.length > 0 && (
                <div className="info-row">
                  <span className="info-label">Attachments</span>
                  <span>{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions (Admin/Support only) */}
          {!isClient && (
            <div className="detail-card">
              <h3>Actions</h3>
              <div className="action-list">
                <div className="action-group">
                  <label>Change Status</label>
                  <select value={request.statusId} onChange={(e) => handleStatusChange(e.target.value)}>
                    {statuses
                      .filter(s => !(user.role === 'support' && s.name === 'Escalated'))
                      .filter(s => s.name !== 'Reopened')
                      .filter(s => !(user.role !== 'admin' && (s.name === 'Closed' || s.name === 'Rejected')))
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {user?.role === 'admin' && (
                <div className="action-group">
                  <label>Assign To</label>
                  <select value={request.assignedTo || ''} onChange={(e) => handleAssign(e.target.value)}>
                    <option value="">Unassigned</option>
                    <optgroup label="Escalation Team">
                      {users.filter(u => u.role === 'support').map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Developers">
                      {users.filter(u => u.role === 'developer').map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                )}
              </div>
            </div>
          )}

          {/* Client Actions */}
          {isClient && (
            <div className="detail-card">
              <h3>Actions</h3>
              <div className="action-list">
                <div className="action-group">
                  <label>Change Status</label>
                  <select
                    value=""
                    onChange={(e) => e.target.value && handleStatusChange(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select status</option>
                    <option value={statuses.find(s => s.name === 'Closed')?.id}>Closed</option>
                    <option value={statuses.find(s => s.name === 'Rejected')?.id}>Rejected</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Assignee */}
          <div className="detail-card">
            <h3>Assigned to</h3>
            {request.assignee ? (
              <div className="assignee-info">
                <div className="assignee-avatar-lg" style={{ background: '#3B82F6' }}>{request.assignee.name.charAt(0)}</div>
                <div>
                  <div className="assignee-name">{request.assignee.name}</div>
                  <div className="assignee-role">{request.assignee.role === 'support' ? 'Support' : 'Developer'}</div>
                </div>
              </div>
            ) : (
              <p className="unassigned">Not assigned yet</p>
            )}
          </div>

          {/* Timeline / History */}
          <div className="detail-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, border: 'none', padding: 0 }}>📜 History</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="action-btn-text edit"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? 'Hide History' : 'Show History'}
                </button>
                <button
                  className="action-btn-text delete"
                  onClick={() => setShowClearConfirm(true)}
                >
                  Clear History
                </button>
              </div>
            </div>

            {showHistory && (
              <>
                {/* Status Lifecycle Flow */}
                <div className="status-lifecycle">
                  <div className="lifecycle-header">
                    <span className="lifecycle-icon">🔄</span>
                    <span className="lifecycle-title">Status Flow</span>
                  </div>
                  <div className="lifecycle-flow">
                    {getStatusFlow().map((step, idx) => (
                      <React.Fragment key={step.name}>
                        <div className={`lifecycle-step ${step.visited ? 'visited' : ''} ${step.current ? 'current' : ''} ${step.isPast ? 'past' : ''}`}>
                          <div className="lifecycle-dot" style={{
                            background: step.visited ? step.color : '#d1d5db',
                            boxShadow: step.current ? `0 0 0 4px ${step.color}30, 0 0 12px ${step.color}50` : 'none'
                          }}>
                            {step.visited && <span className="lifecycle-check">✓</span>}
                            {step.current && <span className="lifecycle-pulse" style={{ borderColor: step.color }}></span>}
                          </div>
                          <span className="lifecycle-label" style={{ color: step.visited ? step.color : 'rgb(156, 163, 175)', fontWeight: step.current ? 700 : step.visited ? 600 : 400 }}>
                            {step.name}
                          </span>
                          {step.time && (
                            <span className="lifecycle-time">
                              {step.user && <span className="lifecycle-user">{step.user}</span>}
                              {new Date(step.time).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {idx < getStatusFlow().length - 1 && (
                          <div className="lifecycle-connector" style={{
                            background: step.isPast ? `linear-gradient(90deg, ${step.color}, ${getStatusFlow()[idx + 1].color})` : '#e5e7eb'
                          }}></div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="timeline">
                  {loadingActivity ? (
                    <div className="loading-screen" style={{ minHeight: 'auto', padding: '20px' }}><div className="spinner"></div></div>
                  ) : activityLog.filter(a => a.user?.id !== user?.id).length === 0 ? (
                    <div className="empty-state">No activity from others yet</div>
                  ) : (
                    <div className="timeline-list">
                      {activityLog.filter(a => a.user?.id !== user?.id).map((activity) => (
                        <div key={activity.id} className="timeline-item">
                          <div className="timeline-marker" style={{ background: getActivityColor(activity.type) }}></div>
                          <div className="timeline-connector"></div>
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <span className="timeline-icon" style={{ color: getActivityColor(activity.type) }}>
                                {getActivityIcon(activity.type)}
                              </span>
                              <span className="timeline-message">{activity.message}</span>
                            </div>
                            <div className="timeline-meta">
                              <span className="timeline-user">{activity.user?.name || 'System'}</span>
                              <span className="timeline-dot">·</span>
                              <span className="timeline-time">{new Date(activity.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', background: '#1e293b' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>Are you sure you want to clear this history?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => {
                api.delete('/api/requests/' + id + '/activity').then(() => {
                  setActivityLog([]);
                  showStatusToast('History cleared', 'success');
                  setShowClearConfirm(false);
                }).catch(() => { showStatusToast('Failed to clear history', 'error'); setShowClearConfirm(false); });
              }} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Preview" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
          <button className="lightbox-close" onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </div>
  );
}
