import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import Toast from './Toast';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded, translateActivityMessage } from '../i18n/translateServer';
import Icon from './Icon';

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
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
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [commentSearch, setCommentSearch] = useState('');
  const [commentFilter, setCommentFilter] = useState('all');
  const [commentSort, setCommentSort] = useState('oldest');
  const commentFileInputRef = useRef(null);
  const commentTextareaRef = useRef(null);
  const chatRef = useRef(null);
  const lastSeenRef = useRef(null);
  const [unreadFilterIds, setUnreadFilterIds] = useState(null);
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const isClient = user?.role === 'client';
  const basePath = isClient ? '/client' : '';

  // Support and developer can only comment on their own assigned requests
  const canComment = (() => {
    if (user?.role === 'admin' || isClient) return true;
    if (user?.role === 'support' || user?.role === 'developer') {
      if (!request) return true;
      return request.assignedTo === user.id;
    }
    return true;
  })();

  // A Resolved request Closed/Rejected by the Client is read-only for staff:
  // Admin, Developer and Escalation Team can view everything (details,
  // comments, history, Status Flow) but must not change the status.
  const closedByClient = (() => {
    if (!request || (request.statusId !== '6' && request.statusId !== '8')) return false;
    const closers = (activityLog || [])
      .filter(a => a.type === 'status_update' && /to (Closed|Rejected)\s*$/i.test(a.message || ''))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return closers.length > 0 && closers[0].user?.role === 'client';
  })();
  const staffReadOnly = !isClient && closedByClient;

  const unreadComments = (request?.comments || []).filter(c =>
    c.user?.id !== user?.id &&
    lastSeenRef.current !== null &&
    new Date(c.createdAt).getTime() > lastSeenRef.current
  );
  const unreadCount = unreadComments.length;

  const isChatNearBottom = () => {
    const el = chatRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const scrollChatToBottom = () => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  const lastSeenKey = `rhms_comment_seen_${id}`;
  const ignoreInitialScrollResetRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  const persistLastSeen = () => {
    lastSeenRef.current = Date.now();
    try { localStorage.setItem(lastSeenKey, String(lastSeenRef.current)); } catch (e) {}
  };

  const initLastSeen = () => {
    if (lastSeenRef.current !== null) return;
    let stored = null;
    try { stored = localStorage.getItem(lastSeenKey); } catch (e) {}
    const val = stored ? parseInt(stored, 10) : NaN;
    lastSeenRef.current = Number.isNaN(val) ? Date.now() : val;
    if (!stored) {
      try { localStorage.setItem(lastSeenKey, String(lastSeenRef.current)); } catch (e) {}
    }
  };

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

  // Auto-scroll chat to the bottom on first load and when new comments arrive while at the bottom
  useEffect(() => {
    if (!request) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      requestAnimationFrame(scrollChatToBottom);
      setTimeout(() => { ignoreInitialScrollResetRef.current = false; }, 400);
      return;
    }
    if (isChatNearBottom()) {
      requestAnimationFrame(scrollChatToBottom);
    }
  }, [request?.comments?.length]);

  // Reset the unread counter when the user scrolls to the latest comments
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isChatNearBottom() && !ignoreInitialScrollResetRef.current) persistLastSeen();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [request?.comments?.length]);

  // Real-time chat: poll comments so new ones appear without a manual refresh
  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      api.get(`/api/requests/${id}`).then(data => {
        setRequest(prev => prev ? { ...prev, comments: data.comments, status: data.status, statusId: data.statusId, assignedTo: data.assignedTo } : data);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
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
      addToast(t('common.feedbackSubmitted'));
      showStatusToast(t('common.feedbackSubmittedShort'), 'success');
      loadFeedback();
    } catch (err) {
      addToast(t('common.failedSubmitFeedback') + ': ' + err.message, 'error');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const loadRequest = () => {
    api.get(`/api/requests/${id}`).then(data => {
      setRequest(data);
      initLastSeen();
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
    if (staffReadOnly) return;
    if (isClient && (statusId === '6' || statusId === '8') && request.statusId !== '5') {
      addToast(t('common.closeRejectResolvedOnly'), 'error');
      return;
    }
    try {
      await api.put(`/api/requests/${id}`, { statusId });
      loadRequest();
      loadActivity();
      addToast(t('common.statusUpdated'));
      showStatusToast(t('common.requestStatusUpdated', { id }), 'status', id);
    } catch (err) {
      addToast(t('common.failedToUpdateStatus') + ': ' + err.message, 'error');
    }
  };

  const handleClaim = async () => {
    if (staffReadOnly) return;
    setClaiming(true);
    try {
      await api.put(`/api/requests/${id}/claim`);
      loadRequest();
      loadActivity();
      addToast(t('common.requestClaimed'));
      showStatusToast(t('common.requestClaimedWithId', { id }), 'assignment', id);
    } catch (err) {
      addToast(t('common.failedToClaim') + ': ' + err.message, 'error');
    } finally {
      setClaiming(false);
    }
  };

  const handleAssign = async (assignedTo) => {
    if (staffReadOnly) return;
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
      addToast(t('common.assigneeUpdated'));
      showStatusToast(t('common.assigneeUpdatedWithId', { id }), 'assignment', id);
    } catch (err) {
      setRequest(v => ({ ...v, assignedTo: prev.assignedTo, statusId: prev.statusId, status: prev.status, assignee: prev.assignee }));
      addToast(t('common.failedUpdateAssignee') + ': ' + err.message, 'error');
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
        addToast(t('common.uploadFailed') + ': ' + err.message, 'error');
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
      addToast(t('common.requestUpdated'));
      showStatusToast(t('common.requestUpdatedWithId', { id }), 'status', id);
    } catch (err) {
      console.error('Save failed:', err);
      addToast(t('common.failedSaveChanges') + ': ' + err.message, 'error');
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
        addToast(t('common.filesUploaded'));
        showStatusToast(t('common.filesUploadedToRequest', { id }), 'status', id);
      }
    } catch (err) {
      addToast(t('common.failedUploadFiles') + ': ' + err.message, 'error');
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
      addToast(t('common.commentAdded'));
      loadRequest();
      loadActivity();
      showStatusToast(t('common.commentAddedToRequest', { id }), 'comment', id);
      setTimeout(() => { scrollChatToBottom(); persistLastSeen(); }, 100);
    } catch (err) {
      addToast(t('common.failedAddComment') + ': ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Rejected: '#DC2626' };
    return colors[status?.name] || '#6B7280';
  };

  // Abstract per-status animation for the Status Flow dots (visual only).
  // Custom statuses are matched by meaning-keywords; unknown names fall back
  // to a subtle neutral animation. Colors always come from getStatusColor.
  const getStatusAnim = (name) => {
    const n = String(name || '').toLowerCase();
    if (/escalat|urgent|critical|alert|alarm/.test(n)) return 'anim-escalated';
    if (/wait|pending|client|hold|paused/.test(n)) return 'anim-waiting';
    if (/resolv|fix|done|success|verif|approv/.test(n)) return 'anim-resolved';
    if (/clos|complet|lock|archiv|finish|final/.test(n)) return 'anim-closed';
    if (/reject|cancel|declin|denied/.test(n)) return 'anim-rejected';
    if (/progress|work|start|develop|handl|review|test/.test(n)) return 'anim-progress';
    if (/assign|claim|owner|agent|triage|pick/.test(n)) return 'anim-assigned';
    if (/new|open|creat|receiv|submit|report/.test(n)) return 'anim-new';
    return 'anim-neutral';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const getActivityIcon = (type) => {
    const icons = { created: 'requests', status_update: 'refresh', assigned: 'user', comment: 'comment', updated: 'edit' };
    return icons[type] || 'clipboard';
  };

  const getActivityColor = (type) => {
    const colors = { created: '#3B82F6', status_update: '#F59E0B', assigned: '#8B5CF6', comment: '#10B981', updated: '#6B7280' };
    return colors[type] || '#6B7280';
  };

  const roleLabel = (role) => {
    const labels = { admin: t('role.admin'), developer: t('role.developer'), client: t('role.client'), support: t('role.escalation'), escalation: t('role.escalation'), system: t('role.system') };
    return labels[role] || role || t('role.system');
  };

  const chatRoleLabel = (role) => {
    const labels = { admin: t('role.administrator'), developer: t('role.developer'), client: t('role.client'), support: t('role.escalationTeam'), escalation: t('role.escalationTeam'), system: t('role.system') };
    return labels[role] || role || t('role.system');
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
    if (day.getTime() === today.getTime()) return t('common.today');
    if (day.getTime() === yesterday.getTime()) return t('common.yesterday');
    return day.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const systemMessageText = (a) => {
    if (a.type === 'created') return t('system.requestCreated');
    if (a.type === 'status_update') {
      const match = a.message.match(/Changed status from (.+) to (.+)/i);
      if (match) return t('system.statusChangedFromTo', { from: transSeeded(match[1].trim(), 'status', t), to: transSeeded(match[2].trim(), 'status', t) });
      return translateActivityMessage(a.message, a.type, t);
    }
    if (a.type === 'assigned') return translateActivityMessage(a.message, a.type, t) || t('system.requestAssigned');
    if (a.type === 'updated') return translateActivityMessage(a.message, a.type, t) || t('system.requestUpdated');
    return translateActivityMessage(a.message, a.type, t) || t('system.activity');
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

    let filteredComments = comments;
    if (commentSearch.trim()) {
      const q = commentSearch.toLowerCase();
      filteredComments = filteredComments.filter(c => String(c.content || '').toLowerCase().includes(q));
    }
    if (commentFilter === 'client') filteredComments = filteredComments.filter(c => c.user?.role === 'client');
    if (commentFilter === 'staff') filteredComments = filteredComments.filter(c => c.user?.role !== 'client');
    if (unreadFilterIds) {
      filteredComments = filteredComments.filter(c => unreadFilterIds.includes(c.id || c.createdAt));
    }

    const sortedComments = [...filteredComments].sort((a, b) => {
      const diff = new Date(a.createdAt) - new Date(b.createdAt);
      return commentSort === 'latest' ? -diff : diff;
    });

    const items = [];
    let lastDay = null;
    sortedComments.forEach(c => {
      const ts = new Date(c.createdAt);
      const day = ts.toDateString();
      if (day !== lastDay) {
        items.push({ kind: 'separator', ts });
        lastDay = day;
      }
      items.push({ kind: 'comment', comment: c });
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
          user: a.user?.name || t('role.system'),
          role: a.user?.role || 'system',
          description: t('system.created')
        });
      } else if (a.type === 'assigned') {
        pushStep({
          name: 'Assigned',
          time: a.createdAt,
          user: a.user?.name || t('role.system'),
          role: a.user?.role || 'system',
          description: translateActivityMessage(a.message, a.type, t) || t('system.assigned')
        });
      } else if (a.type === 'status_update') {
        const match = a.message.match(/Changed status from (.+) to (.+)/i);
        const fromStatus = match ? match[1].trim() : null;
        const toStatus = match ? match[2].trim() : null;
        if (toStatus) {
          pushStep({
            name: toStatus,
            time: a.createdAt,
            user: a.user?.name || t('role.system'),
            role: a.user?.role || 'system',
            description: fromStatus ? `${transSeeded(fromStatus, 'status', t)} → ${transSeeded(toStatus, 'status', t)}` : translateActivityMessage(a.message, a.type, t)
          });
        }
      }
    });

    if (statusSequence.length === 0 && request.status) {
      statusSequence.push({
        name: request.status.name,
        time: request.createdAt,
        user: request.client?.name || t('role.system'),
        role: request.client?.role || 'client',
        description: t('system.created')
      });
    }

    const lastItem = statusSequence[statusSequence.length - 1];
    const currentStatus = request.status?.name;
    if (currentStatus && (!lastItem || lastItem.name !== currentStatus)) {
      statusSequence.push({
        name: currentStatus,
        time: request.updatedAt || request.createdAt,
        user: t('role.system'),
        role: 'system',
        description: t('system.currentStatus')
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
          <button className="back-link" onClick={() => navigate(`${basePath}/requests`)}>← {t('common.backToRequests')}</button>
          <h1>{t('common.requestPrefixLabel')}{String(id).padStart(4, '0')}</h1>
        </div>
      </div>
      <div className="loading-screen"><div className="spinner"></div></div>
    </div>
  );
  if (!request) return <div className="empty-state">{t('common.requestNotFound')}</div>;

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
          <button className="back-link" onClick={() => navigate(`${basePath}/requests`)}>← {t('common.backToRequests')}</button>
          <h1>{t('common.requestPrefixLabel')}{String(request.id || '').padStart(4, '0')}</h1>
          <p>{request.subject}</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {/* Request Details Card */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3>{t('common.requestDetails')}</h3>

            </div>
            {editing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>{t('common.requestTitle')}</label>
                  <input type="text" value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('common.description')}</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={6} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('common.category')}</label>
                    <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                      {categories.map(c => <option key={c.id} value={c.id}>{transSeeded(c.name, 'category', t)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('common.priority')}</label>
                    <select value={editForm.priorityId} onChange={(e) => setEditForm({ ...editForm, priorityId: e.target.value })}>
                      {prioritiesList.map(p => <option key={p.id} value={p.id}>{transSeeded(p.name, 'priority', t)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('common.attachments')}</label>
                  <div className="attachments-grid">
                    {editAttachments.map((path, i) => (
                      <div key={`existing-${i}`} className="attachment-item">
                        {isImageFile(path) ? (
                          <img src={`${API_BASE}${path}`} alt={getFileName(path)} className="attachment-image" onClick={() => setLightbox(`${API_BASE}${path}`)} />
                        ) : (
                          <a href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer" className="attachment-file">
                            <span className="attachment-file-icon"><Icon name="file" size={16} /></span>
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
                            <span className="attachment-file-icon"><Icon name="file" size={16} /></span>
                            <span>{file.name}</span>
                          </div>
                        )}
                        <button type="button" className="file-preview-remove" onClick={() => removeNewFile(i)} style={{ position: 'absolute', top: 4, right: 4, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="file-upload" onClick={() => fileInputRef.current.click()} style={{ marginTop: 12 }}>
                    <input type="file" ref={fileInputRef} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                <div className="file-upload-icon"><Icon name="upload" size={40} /></div>
                    <div className="file-upload-text">{t('common.clickToUpload')}</div>
                    <div className="file-upload-hint">{t('common.uploadHint')}</div>
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn btn-outline" onClick={() => { setEditing(false); setNewFiles([]); loadRequest(); }}>{t('common.cancel')}</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>
                    {uploading ? t('common.saving') : t('common.saveChanges')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="detail-content">
                <p className="detail-description">{request.description}</p>
                {attachments.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ marginBottom: 8, fontSize: 14, color: '#6B7280' }}>{t('common.attachmentsCount', { count: attachments.length })}</h4>
                    <div className="attachments-grid">
                      {attachments.map((path, i) => (
                        <div key={i} className="attachment-item">
                          {isImageFile(path) ? (
                            <img src={`${API_BASE}${path}`} alt={getFileName(path)} className="attachment-image" onClick={() => setLightbox(`${API_BASE}${path}`)} />
                          ) : (
                            <a href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer" className="attachment-file">
                            <span className="attachment-file-icon"><Icon name="file" size={16} /></span>
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
              <h3><Icon name="paperclip" size={16} /> {t('common.uploadAdditionalFiles')}</h3>
              <div className="file-upload" onClick={() => fileInputRef.current.click()}>
                <input type="file" ref={fileInputRef} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                <div className="file-upload-icon"><Icon name="upload" size={40} /></div>
                <div className="file-upload-text">{t('common.clickUploadAdditional')}</div>
                <div className="file-upload-hint">{t('common.uploadHint')}</div>
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
                            <span className="attachment-file-icon"><Icon name="file" size={16} /></span>
                            <span>{file.name}</span>
                          </div>
                        )}
                        <button type="button" className="file-preview-remove" onClick={() => removeNewFile(i)} style={{ position: 'absolute', top: 4, right: 4, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={handleUploadAdditional} disabled={uploading} style={{ marginTop: 12 }}>
                    {uploading ? t('common.uploading') : t('common.uploadFiles')}
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
                  <h4 className="feedback-thanks">{t('feedback.thanks')}</h4>
                  <p className="feedback-subtitle">{t('feedback.helpUsImprove')}</p>
                  <div className="feedback-stars-display">
                    {[1, 2, 3, 4, 5].map(i => (
                      <svg key={i} className={`feedback-star ${i <= existingFeedback.rating ? 'filled' : ''}`} width="32" height="32" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <div className="feedback-rating-label">
                    {existingFeedback.rating === 1 ? t('feedback.poor') :
                     existingFeedback.rating === 2 ? t('feedback.fair') :
                     existingFeedback.rating === 3 ? t('feedback.good') :
                     existingFeedback.rating === 4 ? t('feedback.veryGood') : t('feedback.excellent')}
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
                    <span className="feedback-form-icon"><Icon name="feedback" size={22} /></span>
                    <h3>{t('feedback.rateThisRequest')}</h3>
                  </div>
                  <p className="feedback-form-prompt">
                    {t('feedback.ratePrompt')}
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
                          aria-label={t('feedback.rateStars', { count: i })}
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
                        <span className="hint-default">{t('feedback.tapStar')}</span>
                      ) : (
                        <span className={`hint-active rating-${hoverRating || feedbackRating}`}>
                          {(hoverRating || feedbackRating) === 1 && `😞 ${t('feedback.poor')}`}
                          {(hoverRating || feedbackRating) === 2 && `😐 ${t('feedback.fair')}`}
                          {(hoverRating || feedbackRating) === 3 && `🙂 ${t('feedback.good')}`}
                          {(hoverRating || feedbackRating) === 4 && `😊 ${t('feedback.veryGood')}`}
                          {(hoverRating || feedbackRating) === 5 && `🤩 ${t('feedback.excellent')}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="feedback-textarea-group">
                    <label className="feedback-textarea-label">
                      {t('feedback.shareDetails')} <span>({t('common.optional')})</span>
                    </label>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) setFeedbackComment(e.target.value);
                      }}
                      placeholder={t('feedback.likeImprove')}
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
                      <><span className="feedback-spinner"></span> {t('common.submitting')}...</>
                    ) : (
                      t('feedback.submitFeedback')
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
                <span className="chat-header-icon"><Icon name="comment" size={16} /></span>
                <span className="chat-header-text">{t('common.comments')}</span>
                <span className="chat-count">({request.comments?.length || 0})</span>
              </div>
              <div className="chat-header-actions">
                <div className="chat-search">
                  <span className="chat-search-icon"><Icon name="search" size={13} /></span>
                  <input
                    type="text"
                    placeholder={t('common.searchComments')}
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                  />
                </div>
                <select className="chat-filter" value={commentFilter} onChange={(e) => setCommentFilter(e.target.value)}>
                  <option value="all">{t('common.all')}</option>
                  <option value="client">{t('common.fromClient')}</option>
                  <option value="staff">{t('common.fromStaff')}</option>
                </select>
                <button
                  className="chat-sort-btn"
                  onClick={() => setCommentSort(commentSort === 'latest' ? 'oldest' : 'latest')}
                  title={t('common.toggleSortOrder')}
                >
                  {commentSort === 'latest' ? t('common.sortLatest') : t('common.sortOldest')}
                </button>
              </div>
            </div>

            <div className="chat-conversation" ref={chatRef}>
              {buildChatItems().map((item, idx) => {
                if (item.kind === 'separator') {
                  return (
                    <div key={`sep-${idx}`} className="chat-date-separator">
                      <span>{dayLabel(item.ts)}</span>
                    </div>
                  );
                }
                const c = item.comment;
                const isClientRole = c.user?.role === 'client';
                const isOwnComment = !!user && !!c.user && c.user.id === user.id;
                return (
                  <div key={c.id || `cm-${idx}`} className={`chat-row ${isOwnComment ? 'right' : ''}`}>
                    <div className={`chat-avatar ${isClientRole ? 'client' : 'staff'}`}>{renderAvatar(c.user)}</div>
                    <div className="chat-column">
                      <div className="chat-meta">
                        <span className="chat-name">{c.user?.name || t('common.unknown')}</span>
                        <span className={`chat-role-badge ${isClientRole ? 'client' : 'staff'}`}>{chatRoleLabel(c.user?.role)}</span>
                        <span className="chat-time">{new Date(c.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <div className={`chat-bubble ${isClientRole ? 'client' : 'staff'}`}>
                        {renderMessageContent(c.content)}
                        {c.attachments && c.attachments.length > 0 && (
                          <div className="msg-attachments">
                            {c.attachments.map((att, ai) => (
                              <div key={ai} className="msg-attachment">
                                <span className="msg-att-icon"><Icon name={isImageFile(att.path) ? 'image' : 'paperclip'} size={14} /></span>
                                <div className="msg-att-info">
                                  <span className="msg-att-name">{att.name || getFileName(att.path)}</span>
                                  <span className="msg-att-size">{formatSize(att.size)}</span>
                                </div>
                                <a className="msg-att-download" href={`${API_BASE}${att.path}`} download target="_blank" rel="noopener noreferrer" title={t('common.download')}>⬇</a>
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
                <div className="chat-empty">{t('common.noMessagesYet')}</div>
              )}
            </div>

            <button
              type="button"
              className="chat-unread-float"
              style={{ bottom: canComment ? 76 : 16 }}
              title={t('common.unreadComments')}
              onClick={() => {
                if (unreadFilterIds) {
                  setUnreadFilterIds(null);
                } else {
                  const ids = unreadComments.map(c => c.id || c.createdAt);
                  if (ids.length > 0) {
                    setUnreadFilterIds(ids);
                    persistLastSeen();
                  }
                }
              }}
            >
              <Icon name="comment" size={18} />
              {unreadCount > 0 && !unreadFilterIds && (
                <span className="badge chat-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {canComment ? (
              <div className="chat-composer">
                {pendingFiles.length > 0 && (
                  <div className="composer-pending">
                    {pendingFiles.map((file, i) => (
                      <div key={`pf-${i}`} className="composer-pending-item">
                        <span className="composer-pending-icon"><Icon name="paperclip" size={14} /></span>
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
                  <button type="button" className="composer-btn" title={t('common.attachFile')} onClick={() => commentFileInputRef.current?.click()}><Icon name="paperclip" size={16} /></button>
                  <button type="button" className="composer-btn" title={t('common.emoji')} onClick={() => setShowEmojiPicker(v => !v)}><Icon name="smile" size={16} /></button>
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
                    placeholder={t('common.typeComment')}
                    rows={1}
                  />
                  <button
                    type="button"
                    className="composer-send"
                    title={t('common.send')}
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
                <div className="composer-hint">{t('common.composerHint')}</div>
              </div>
            ) : (
              <div className="composer-hint" style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>
                {t('common.readOnly')}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          <div className="detail-card">
            <h3>{t('common.information')}</h3>
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">{t('common.status')}</span>
                <span className="status-badge" style={{ background: getStatusColor(request.status) + '20', color: getStatusColor(request.status) }}>{transSeeded(request.status?.name, 'status', t)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('common.priority')}</span>
                <span className="priority-badge" style={{ background: getPriorityColor(request.priority) + '20', color: getPriorityColor(request.priority) }}>{transSeeded(request.priority?.name, 'priority', t)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('common.category')}</span>
                <span>{transSeeded(request.category?.name, 'category', t)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('common.client')}</span>
                <span>{request.clientDeleted ? t('common.clientDeleted') : (request.client?.name || '-')}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('common.created')}</span>
                <span>{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('common.lastUpdated')}</span>
                <span>{new Date(request.updatedAt).toLocaleDateString()}</span>
              </div>
              {attachments.length > 0 && (
                <div className="info-row">
                  <span className="info-label">{t('common.attachments')}</span>
                  <span>{t('common.fileCount', { count: attachments.length })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions (Admin/Support only) — hidden for client-closed requests */}
          {!isClient && !staffReadOnly && (
            <div className="detail-card">
              <h3>{t('common.actions')}</h3>
              <div className="action-list">
                <div className="action-group">
                  <label>{t('common.changeStatus')}</label>
                  {((user?.role === 'developer' && request.status?.name === 'New' && request.assignedTo !== user.id) ||
                    (user?.role === 'support' && request.status?.name === 'Escalated' && request.assignedTo !== user.id)) ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleClaim}
                      disabled={claiming}
                      style={{ width: '100%' }}
                    >
                      {claiming ? t('common.claiming') : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="user" size={16} /> {t('common.claimAssignMe')}</span>}
                    </button>
                  ) : (
                    <select value={request.statusId} onChange={(e) => handleStatusChange(e.target.value)}>
                      {statuses
                        .filter(s => s.name !== 'Rejected')
                        .filter(s => !((user.role === 'developer' || user.role === 'support') && (s.name === 'Closed' || s.name === 'Rejected')))
                        .map(s => <option key={s.id} value={s.id}>{transSeeded(s.name, 'status', t)}</option>)}
                    </select>
                  )}
                </div>
                {user?.role === 'admin' && (
                <div className="action-group">
                  <label>{t('common.assignTo')}</label>
                  <select value={request.assignedTo || ''} onChange={(e) => handleAssign(e.target.value)}>
                    <option value="">{t('common.unassigned')}</option>
                    <optgroup label={t('role.escalationTeam')}>
                      {users.filter(u => u.role === 'support').map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label={t('role.developers')}>
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
              <h3>{t('common.actions')}</h3>
              <div className="action-list">
                <div className="action-group">
                  <label>{t('common.changeStatus')}</label>
                  <select
                    value=""
                    onChange={(e) => e.target.value && handleStatusChange(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">{t('common.selectStatus')}</option>
                    <option value={statuses.find(s => s.name === 'Closed')?.id}>{t('common.closed')}</option>
                    <option value={statuses.find(s => s.name === 'Rejected')?.id}>{t('common.rejected')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Assignee */}
          <div className="detail-card">
            <h3>{t('common.assignedTo')}</h3>
            {request.assignee ? (
              <div className="assignee-info">
                <div className="assignee-avatar-lg" style={{ background: '#3B82F6', overflow: 'hidden' }}>{request.assignee.avatar ? <img src={`${API_BASE}${request.assignee.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : request.assignee.name.charAt(0)}</div>
                <div>
                  <div className="assignee-name">{request.assignee.name}</div>
                  <div className="assignee-role">{request.assignee.role === 'support' ? t('role.support') : t('role.developer')}</div>
                </div>
              </div>
            ) : (
              <p className="unassigned">{t('common.notAssignedYet')}</p>
            )}
          </div>

          {/* Timeline / History moved to full-width section below Comments */}
        </div>
      </div>

      {/* History (full width: Request Details → Comments → History) */}
      <div className="detail-history-full">
          <div className="detail-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, border: 'none', padding: 0 }}>📜 {t('common.history')}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="action-btn-text edit"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? t('common.hideHistory') : t('common.showHistory')}
                </button>
              </div>
            </div>

            {showHistory && (
              <>
                {/* Status Lifecycle Flow */}
                <div className="status-lifecycle">
                  <div className="lifecycle-header">
                    <span className="lifecycle-icon"><Icon name="refresh" size={16} /></span>
                    <span className="lifecycle-title">{t('common.statusFlow')}</span>
                  </div>
                  <div className="lifecycle-flow">
                    {(() => {
                      const flowSteps = getStatusFlow();
                      const requestId = `REQ-${String(id).padStart(4, '0')}`;
                      return flowSteps.map((step, idx) => (
                        <React.Fragment key={idx}>
                          <div className={`lifecycle-step visited ${step.current ? 'current' : ''} ${step.isPast ? 'past' : ''}`}>
                            <div className={`lifecycle-dot ${step.current ? getStatusAnim(step.name) : 'anim-none'}`} style={{
                              background: step.color,
                              '--step-color': step.color,
                              boxShadow: step.current ? `0 0 0 4px ${step.color}30, 0 0 12px ${step.color}50` : 'none',
                              animationDelay: `${idx * 0.15}s`
                            }}>
                              {step.isPast && <span className="lifecycle-check">✓</span>}
                              {step.current && <span className="lifecycle-pulse" style={{ borderColor: step.color }}></span>}
                            </div>
                            <span className="lifecycle-label" style={{ color: step.color, fontWeight: step.current ? 700 : 600 }}>
                              {transSeeded(step.name, 'status', t)}
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
                              animationDelay: `${(idx + 1) * 0.15}s`,
                              '--arrow-delay': `${idx * 0.45}s`
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
                    <div className="empty-state">{t('common.noActivityYet')}</div>
                  ) : (
                    <div className="timeline-list">
                      {activityLog.map((activity) => (
                        <div key={activity.id} className="timeline-item">
                          <div className="timeline-marker" style={{ background: getActivityColor(activity.type) }}></div>
                          <div className="timeline-connector"></div>
                          <div className="timeline-content">
                            <div className="timeline-header">
                              <span className="timeline-icon" style={{ color: getActivityColor(activity.type) }}>
                                {getActivityIcon(activity.type) && <Icon name={getActivityIcon(activity.type)} size={16} />}
                              </span>
                              <span className="timeline-message">{translateActivityMessage(activity.message, activity.type, t)}</span>
                            </div>
                            <div className="timeline-meta">
                              <span className="timeline-user">{activity.user?.name || t('role.system')}</span>
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

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt={t('common.preview')} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
          <button className="lightbox-close" onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: '#fff', color: '#333', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </div>
  );
}
