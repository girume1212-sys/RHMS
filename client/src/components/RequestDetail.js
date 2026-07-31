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
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentSearch, setCommentSearch] = useState('');
  const [commentFilter, setCommentFilter] = useState('all');
  const [commentSort, setCommentSort] = useState('latest');
  const commentFileInputRef = useRef(null);
  const commentTextareaRef = useRef(null);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [claiming, setClaiming] = useState(false);
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
    api.get('/api/statuses').then(setStatuses).catch(() => {});
    if (!isClient) {
      api.get('/api/users').then(setUsers).catch(() => {});
    }
    api.get('/api/categories').then(setCategories).catch(() => {});
    api.get('/api/priorities').then(setPriorities).catch(() => {});
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
    }).catch(() => setLoading(false));
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
    if (isClient && (statusId === '6' || statusId === '8') && request.statusId !== '5') {
      addToast('You can only close or reject a request that is in Resolved status.', 'error');
      return;
    }
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

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await api.put(`/api/requests/${id}/claim`);
      loadRequest();
      loadActivity();
      addToast('Request claimed successfully!');
      showStatusToast(`Request #${id} claimed`, 'assignment', id);
    } catch (err) {
      addToast('Failed to claim: ' + err.message, 'error');
    } finally {
      setClaiming(false);
    }
  };

  const handleAssign = async (assignedTo) => {
    const prev = { assignedTo: request.assignedTo, statusId: request.statusId, status: request.status, assignee: request.assignee };
    const optAssignee = assignedTo ? users.find(u => u.id === assignedTo) : null;
    const optStatus = !prev.assignedTo && assignedTo && prev.statusId === '1' ? statuses.find(s => s.id === '2') : prev.status;
    setRequest(v => ({ ...v, assignedTo: assignedTo || null, statusId: optStatus ? optStatus.id : prev.statusId, status: optStatus || prev.status, assignee: optAssignee ? { id: optAssignee.id, name: optAssignee.name, avatar: optAssignee.avatar } : null }));
    try {
      const result = await api.put(`/api/requests/${id}`, { assignedTo });
      const serverStatus = statuses.find(s => s.id === result.statusId);
      const serverAssignee = result.assignedTo ? users.find(u => u.id === result.assignedTo) : null;
      setRequest(v => ({ ...v, assignedTo: result.assignedTo, statusId: result.statusId, status: serverStatus || v.status, assignee: serverAssignee ? { id: serverAssignee.id, name: serverAssignee.name, avatar: serverAssignee.avatar } : null }));
      loadActivity();
      addToast('Assignee updated successfully!');
      showStatusToast(`Request #${id} assignee updated`, 'assignment', id);
    } catch (err) {
      setRequest(v => ({ ...v, assignedTo: prev.assignedTo, statusId: prev.statusId, status: prev.status, assignee: prev.assignee }));
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

  const handleComment = async () => {
    if (submitting) return;
    if (!comment.trim() && pendingFiles.length === 0) return;
    setSubmitting(true);
    try {
      let attachments = [];
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await api.upload('/api/upload', fd);
          if (res.path) attachments.push({ name: file.name, size: file.size, path: res.path });
        }
      }
      await api.post(`/api/requests/${id}/comments`, { content: comment, attachments });
      setComment('');
      setPendingFiles([]);
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

  const roleLabel = (role) => {
    const labels = { admin: 'Admin', developer: 'Developer', client: 'Client', support: 'Escalation Team', escalation: 'Escalation Team', system: 'System' };
    return labels[role] || role || 'System';
  };

  const chatRoleLabel = (role) => {
    const labels = { admin: 'Administrator', developer: 'Developer', client: 'Client', support: 'Escalation Team', escalation: 'Escalation Team', system: 'System' };
    return labels[role] || role || 'System';
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const dayLabel = (d) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    if (day.getTime() === today.getTime()) return 'Today';
    if (day.getTime() === yesterday.getTime()) return 'Yesterday';
    return day.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const systemMessageText = (a) => {
    if (a.type === 'created') return 'Request created';
    if (a.type === 'status_update') {
      const match = a.message.match(/Changed status from (.+) to (.+)/i);
      if (match) return `Status changed from ${match[1].trim()} to ${match[2].trim()}`;
      return a.message;
    }
    if (a.type === 'assigned') return a.message || 'Request assigned';
    if (a.type === 'updated') return a.message || 'Request updated';
    return a.message || 'Activity';
  };

  const renderInline = (text) => {
    const parts = text.split(/(`[^`]+`|https?:\/\/\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
        return <code key={i} className="msg-inline-code">{part.slice(1, -1)}</code>;
      }
      if (/^https?:\/\//.test(part)) {
        return <a key={i} className="msg-link" href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
      }
      return part;
    });
  };

  const renderMessageContent = (text) => {
    const lines = String(text || '').split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        blocks.push(<pre key={blocks.length} className="msg-code">{codeLines.join('\n')}</pre>);
      } else if (/^[-*•]\s+/.test(line)) {
        const bullets = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
          bullets.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
          i++;
        }
        blocks.push(<ul key={blocks.length} className="msg-list">{bullets.map((b, bi) => <li key={bi}>{renderInline(b)}</li>)}</ul>);
      } else if (line !== '') {
        const para = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^[-*•]\s+/.test(lines[i].trim()) && !lines[i].trim().startsWith('```')) {
          para.push(lines[i]);
          i++;
        }
        blocks.push(
          <p key={blocks.length} className="msg-p">
            {para.map((p, pi) => <span key={pi}>{renderInline(p)}{pi < para.length - 1 && <br />}</span>)}
          </p>
        );
      } else {
        i++;
      }
    }
    return blocks;
  };

  const buildChatItems = () => {
    const comments = request?.comments || [];
    const activities = activityLog.filter(a => a.type !== 'comment');

    let filteredComments = comments;
    if (commentSearch.trim()) {
      const q = commentSearch.toLowerCase();
      filteredComments = filteredComments.filter(c => String(c.content || '').toLowerCase().includes(q));
    }
    if (commentFilter === 'client') filteredComments = filteredComments.filter(c => c.user?.role === 'client');
    if (commentFilter === 'staff') filteredComments = filteredComments.filter(c => c.user?.role !== 'client');

    const sortedComments = [...filteredComments].sort((a, b) => {
      const diff = new Date(a.createdAt) - new Date(b.createdAt);
      return commentSort === 'latest' ? -diff : diff;
    });

    const all = [];
    sortedComments.forEach(c => all.push({ kind: 'comment', ts: new Date(c.createdAt), comment: c }));
    activities.forEach(a => all.push({ kind: 'system', ts: new Date(a.createdAt), activity: a }));
    all.sort((a, b) => a.ts - b.ts);

    const items = [];
    let lastDay = null;
    all.forEach(item => {
      const day = item.ts.toDateString();
      if (day !== lastDay) {
        items.push({ kind: 'separator', ts: item.ts });
        lastDay = day;
      }
      if (item.kind === 'comment') {
        items.push({ kind: 'comment', comment: item.comment });
      } else {
        items.push({ kind: 'system', activity: item.activity });
      }
    });
    return items;
  };

  const insertEmoji = (emoji) => {
    const ta = commentTextareaRef.current;
    const start = ta ? (ta.selectionStart || comment.length) : comment.length;
    const end = ta ? (ta.selectionEnd || comment.length) : comment.length;
    const next = comment.slice(0, start) + emoji + comment.slice(end);
    setComment(next);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(start + emoji.length, start + emoji.length);
      }
    });
    setShowEmojiPicker(false);
  };

  const renderAvatar = (u) => {
    if (u?.avatar) {
      return <img src={`${API_BASE}${u.avatar}`} alt="" className="chat-avatar-img" />;
    }
    return <span className="chat-avatar-initial">{(u?.name || 'U').charAt(0)}</span>;
  };

  const getStatusFlow = () => {
    const statusSequence = [];
    const chronological = [...activityLog].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const pushStep = (step) => {
      const last = statusSequence[statusSequence.length - 1];
      if (last && last.name === step.name) {
        last.description = `${last.description} · ${step.description}`;
        return;
      }
      statusSequence.push(step);
    };

    chronological.forEach((a) => {
      if (a.type === 'created') {
        pushStep({
          name: 'New',
          time: a.createdAt,
          user: a.user?.name || 'System',
          role: a.user?.role || 'system',
          description: 'Created'
        });
      } else if (a.type === 'assigned') {
        pushStep({
          name: 'Assigned',
          time: a.createdAt,
          user: a.user?.name || 'System',
          role: a.user?.role || 'system',
          description: a.message || 'Assigned'
        });
      } else if (a.type === 'status_update') {
        const match = a.message.match(/Changed status from (.+) to (.+)/i);
        const fromStatus = match ? match[1].trim() : null;
        const toStatus = match ? match[2].trim() : null;
        if (toStatus) {
          pushStep({
            name: toStatus,
            time: a.createdAt,
            user: a.user?.name || 'System',
            role: a.user?.role || 'system',
            description: fromStatus ? `${fromStatus} → ${toStatus}` : a.message
          });
        }
      }
    });

    if (statusSequence.length === 0 && request.status) {
      statusSequence.push({
        name: request.status.name,
        time: request.createdAt,
        user: request.client?.name || 'System',
        role: request.client?.role || 'client',
        description: 'Created'
      });
    }

    const lastItem = statusSequence[statusSequence.length - 1];
    const currentStatus = request.status?.name;
    if (currentStatus && (!lastItem || lastItem.name !== currentStatus)) {
      statusSequence.push({
        name: currentStatus,
        time: request.updatedAt || request.createdAt,
        user: 'System',
        role: 'system',
        description: 'Current status'
      });
    }

    return statusSequence.map((step, idx) => ({
      name: step.name,
      color: getStatusColor({ name: step.name }),
      visited: true,
      current: idx === statusSequence.length - 1,
      isPast: idx < statusSequence.length - 1,
      time: step.time,
      user: step.user,
      role: step.role,
      description: step.description
    }));
  };

  const isImageFile = (path) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(path);
  const getFileName = (path) => path.split('/').pop();

  if (loading) return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => navigate(`${basePath}/requests`)}>← Back to Requests</button>
          <h1>REQ-{String(id).padStart(4, '0')}</h1>
        </div>
      </div>
      <div className="loading-screen"><div className="spinner"></div></div>
    </div>
  );
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
          <h1>REQ-{String(request.id || '').padStart(4, '0')}</h1>
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

          {/* Comments / Chat */}
          <div className="chat-card">
            <div className="chat-header">
              <div className="chat-header-title">
                <span className="chat-header-icon">💬</span>
                <span className="chat-header-text">Comments</span>
                <span className="chat-count">({request.comments?.length || 0})</span>
              </div>
              <div className="chat-header-actions">
                <div className="chat-search">
                  <span className="chat-search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search comments..."
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                  />
                </div>
                <select className="chat-filter" value={commentFilter} onChange={(e) => setCommentFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="client">From Client</option>
                  <option value="staff">From Staff</option>
                </select>
                <button
                  className="chat-sort-btn"
                  onClick={() => setCommentSort(commentSort === 'latest' ? 'oldest' : 'latest')}
                  title="Toggle sort order"
                >
                  {commentSort === 'latest' ? 'Sort by Latest' : 'Sort by Oldest'}
                </button>
              </div>
            </div>

            <div className="chat-conversation">
              {buildChatItems().map((item, idx) => {
                if (item.kind === 'separator') {
                  return (
                    <div key={`sep-${idx}`} className="chat-date-separator">
                      <span>{dayLabel(item.ts)}</span>
                    </div>
                  );
                }
                if (item.kind === 'system') {
                  return (
                    <div key={`sys-${idx}`} className="chat-system">
                      <span className="chat-system-line"></span>
                      <span className="chat-system-text">{systemMessageText(item.activity)}</span>
                      <span className="chat-system-line"></span>
                    </div>
                  );
                }
                const c = item.comment;
                const isClientRole = c.user?.role === 'client';
                return (
                  <div key={c.id || `cm-${idx}`} className={`chat-row ${isClientRole ? '' : 'right'}`}>
                    <div className={`chat-avatar ${isClientRole ? 'client' : 'staff'}`}>{renderAvatar(c.user)}</div>
                    <div className="chat-column">
                      <div className="chat-meta">
                        <span className="chat-name">{c.user?.name || 'Unknown'}</span>
                        <span className={`chat-role-badge ${isClientRole ? 'client' : 'staff'}`}>{chatRoleLabel(c.user?.role)}</span>
                        <span className="chat-time">{new Date(c.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <div className={`chat-bubble ${isClientRole ? 'client' : 'staff'}`}>
                        {renderMessageContent(c.content)}
                        {c.attachments && c.attachments.length > 0 && (
                          <div className="msg-attachments">
                            {c.attachments.map((att, ai) => (
                              <div key={ai} className="msg-attachment">
                                <span className="msg-att-icon">{isImageFile(att.path) ? '🖼️' : '📎'}</span>
                                <div className="msg-att-info">
                                  <span className="msg-att-name">{att.name || getFileName(att.path)}</span>
                                  <span className="msg-att-size">{formatSize(att.size)}</span>
                                </div>
                                <a className="msg-att-download" href={`${API_BASE}${att.path}`} download target="_blank" rel="noopener noreferrer" title="Download">⬇</a>
                              </div>
                            ))}
                          </div>
                        )}
                        {c.attachments && c.attachments.filter(a => isImageFile(a.path)).length > 0 && (
                          <div className="msg-images">
                            {c.attachments.filter(a => isImageFile(a.path)).map((att, ai) => (
                              <img
                                key={ai}
                                src={`${API_BASE}${att.path}`}
                                alt={att.name || 'image'}
                                className="msg-image"
                                onClick={() => setLightbox(`${API_BASE}${att.path}`)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(request.comments || []).length === 0 && (
                <div className="chat-empty">No messages yet. Start the conversation!</div>
              )}
            </div>

            <div className="chat-composer">
              {pendingFiles.length > 0 && (
                <div className="composer-pending">
                  {pendingFiles.map((file, i) => (
                    <div key={`pf-${i}`} className="composer-pending-item">
                      <span className="composer-pending-icon">📎</span>
                      <span className="composer-pending-name">{file.name}</span>
                      <button type="button" className="composer-pending-remove" onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {showEmojiPicker && (
                <div className="emoji-picker">
                  {['😀', '😂', '😊', '😍', '👍', '👏', '🙏', '🎉', '🔥', '✅', '❌', '⚠️', '📌', '💡', '📎', '🕐', '🚀', '👀'].map(e => (
                    <button key={e} type="button" className="emoji-picker-item" onClick={() => insertEmoji(e)}>{e}</button>
                  ))}
                </div>
              )}
              <div className="composer-toolbar">
                <button type="button" className="composer-btn" title="Attach file" onClick={() => commentFileInputRef.current?.click()}>📎</button>
                <button type="button" className="composer-btn" title="Emoji" onClick={() => setShowEmojiPicker(v => !v)}>😊</button>
                <textarea
                  ref={commentTextareaRef}
                  className="composer-textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                  placeholder="Type a comment..."
                  rows={1}
                />
                <button
                  type="button"
                  className="composer-send"
                  title="Send"
                  disabled={submitting || (!comment.trim() && pendingFiles.length === 0)}
                  onClick={handleComment}
                >
                  {submitting ? '⏳' : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4z" /></svg>}
                </button>
                <input
                  ref={commentFileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) setPendingFiles(prev => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="composer-hint">Press Enter to send • Shift + Enter for new line</div>
            </div>
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
                  {((user?.role === 'developer' && request.status?.name === 'New' && request.assignedTo !== user.id) ||
                    (user?.role === 'support' && request.status?.name === 'Escalated' && request.assignedTo !== user.id)) ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleClaim}
                      disabled={claiming}
                      style={{ width: '100%' }}
                    >
                      {claiming ? 'Claiming...' : '👤 Claim & Assign to Me'}
                    </button>
                  ) : (
                    <select value={request.statusId} onChange={(e) => handleStatusChange(e.target.value)}>
                      {statuses
                        .filter(s => s.name !== 'Reopened')
                        .filter(s => !((user.role === 'developer' || user.role === 'support') && (s.name === 'Closed' || s.name === 'Rejected')))
                        .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
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
            <h3>ASSIGNED TO</h3>
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
                    {(() => {
                      const flowSteps = getStatusFlow();
                      const requestId = `REQ-${String(id).padStart(4, '0')}`;
                      return flowSteps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className={`lifecycle-step visited ${step.current ? 'current' : ''} ${step.isPast ? 'past' : ''}`}>
                            <div className="lifecycle-dot" style={{
                              background: step.color,
                              boxShadow: step.current ? `0 0 0 4px ${step.color}30, 0 0 12px ${step.color}50` : 'none',
                              animationDelay: `${idx * 0.15}s`
                            }}>
                              {step.isPast && <span className="lifecycle-check">✓</span>}
                              {step.current && <span className="lifecycle-pulse" style={{ borderColor: step.color }}></span>}
                            </div>
                            <span className="lifecycle-label" style={{ color: step.color, fontWeight: step.current ? 700 : 600 }}>
                              {step.name}
                            </span>
                            {step.time && (
                              <div className="lifecycle-meta">
                                <span className="lifecycle-time">
                                  {new Date(step.time).toLocaleDateString()} {new Date(step.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </span>
                                <span className="lifecycle-user">{step.user}</span>
                                <span className="lifecycle-role">{roleLabel(step.role)}</span>
                                <span className="lifecycle-request">{requestId}</span>
                                <span className="lifecycle-desc">{step.description}</span>
                              </div>
                            )}
                          </div>
                          {idx < flowSteps.length - 1 && (
                            <div className="lifecycle-connector" style={{
                              background: `linear-gradient(90deg, ${step.color}, ${flowSteps[idx + 1].color})`,
                              animationDelay: `${(idx + 1) * 0.15}s`
                            }}></div>
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                </div>

                <div className="timeline">
                  {loadingActivity ? (
                    <div className="loading-screen" style={{ minHeight: 'auto', padding: '20px' }}><div className="spinner"></div></div>
                  ) : activityLog.length === 0 ? (
                    <div className="empty-state">No activity yet</div>
                  ) : (
                    <div className="timeline-list">
                      {activityLog.map((activity) => (
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
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
