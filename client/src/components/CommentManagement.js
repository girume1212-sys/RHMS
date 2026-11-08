import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircleMore, Image as ImageIcon, Video, FileText, Music, Paperclip, Smile, Search } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Icon from './Icon';

function initials(name) {
  return (name || '?').trim().split(/\s+/).map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';
}

function Avatar({ user, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const url = user?.avatar || user?.avatar_url || null;
  if (!url || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(110deg, #0875F9 0%, #2563EB 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.38, flexShrink: 0 }}>
        {initials(user?.name)}
      </div>
    );
  }
  return <img src={url} alt={user?.name || ''} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
}

const ROLE_LABELS = { admin: 'Admin', client: 'Client', developer: 'Developer', support: 'Escalation Team' };

export default function CommentManagement() {
  const { user, darkMode } = useAuth();
  const dark = !!darkMode;
  const T = dark ? { bg:'#0B1220', panel:'#111C2E', surface:'#16243A', bubbleIn:'#1B2A41', border:'#263750', text:'#E6EDF7', text2:'#9AAAC0', muted:'#71829B', accent:'#3B82F6', purple:'#6366F1', btn:'linear-gradient(90deg,#2563EB,#6366F1)', out:'linear-gradient(90deg,#1D4ED8,#4F46E5)', hover:'#1C2B45', input:'#0F1A2B', green:'#22C55E' } : { bg:'#F8FAFF', panel:'#FFFFFF', surface:'#EFF4FF', bubbleIn:'#E9EDFA', border:'#D7E3FF', text:'#102B65', text2:'#38558D', muted:'#6b7280', accent:'#0866F5', purple:'#6366F1', btn:'linear-gradient(90deg,#0875F9,#2563EB)', out:'linear-gradient(90deg,#0875F9,#2563EB)', hover:'#EAF1FF', input:'#FFFFFF', green:'#10B981' };
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState('stickers');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [contextMsg, setContextMsg] = useState(null);
  const [acceptType, setAcceptType] = useState('*/*');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const textareaRef = useRef(null);
  const attachRef = useRef(null);
  const emojiRef = useRef(null);

  const role = user?.role || 'client';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, g] = await Promise.all([
          api.get('/api/users').catch(() => []),
          api.get('/api/groups').catch(() => []),
        ]);
        if (cancelled) return;
        setUsers(Array.isArray(u) ? u : (u?.users || []));
        setGroups(Array.isArray(g) ? g : (g?.groups || []));
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sections = buildSections(role, user, users, groups);

  const openConversation = useCallback(async (conv) => {
    setSelectedUser(conv);
    setMessages([]);
    setText('');
    setAttachments([]);
    setReplyTo(null);
    setEditingId(null);
    setMsgLoading(true);
    try {
      const data = await api.get(`/api/messages?conversationType=${conv.type}&conversationId=${encodeURIComponent(conv.id)}`);
      setMessages(Array.isArray(data) ? data : []);
      await api.put('/api/messages/read', { conversationType: conv.type, conversationId: conv.id });
      setUnreadMap((m) => ({ ...m, [conv.type + ':' + conv.id]: 0 }));
      try { localStorage.setItem('rhms_selected_conv', JSON.stringify({ type: conv.type, id: conv.id })); } catch {}
    } catch (e) {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onClick = (e) => {
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttachMenu(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.get(`/api/messages?conversationType=${selectedUser.type}&conversationId=${encodeURIComponent(selectedUser.id)}`);
        if (Array.isArray(data)) {
          setMessages(data);
          await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
          setUnreadMap((m) => ({ ...m, [selectedUser.type + ':' + selectedUser.id]: 0 }));
        }
      } catch {}
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [selectedUser]);

  // unread counts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const flat = sections.flatMap((s) => s.items);
      for (const it of flat) {
        try {
          const r = await api.get(`/api/messages/unread-count?conversationType=${it.type}&conversationId=${encodeURIComponent(it.id)}`);
          if (!cancelled) setUnreadMap((m) => ({ ...m, [it.type + ':' + it.id]: r?.count || 0 }));
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [sections.length, users.length]);

  useEffect(() => {
    if (loading) return;
    if (selectedUser) return;
    const flat = sections.flatMap((s) => s.items || []);
    if (!flat.length) return;
    let target = flat[0];
    try {
      const saved = JSON.parse(localStorage.getItem('rhms_selected_conv') || 'null');
      if (saved) {
        const found = flat.find((it) => it.type === saved.type && String(it.id) === String(saved.id));
        if (found) target = found;
      }
    } catch {}
    openConversation(target);
  }, [loading, sections.length, selectedUser, openConversation]);

  const uploadAttachments = async (files) => {
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append('file', files[i]);
      try {
        const res = await api.upload('/api/upload', fd);
        uploaded.push({ name: files[i].name, path: res.path, size: files[i].size });
      } catch (e) { console.error(e); }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    setUploadProgress(0);
    return uploaded;
  };

  const send = async () => {
    if ((!text.trim() && attachments.length === 0) || !selectedUser || sending) return;
    setSending(true);
    try {
      let atts = attachments.map((f) => ({ name: f.name, path: f.path || null, size: f.size }));
      // if raw files not uploaded yet
      const rawFiles = attachments.filter((f) => !f.path && f instanceof File);
      if (rawFiles.length) {
        const uploaded = await uploadAttachments(rawFiles);
        atts = [...attachments.filter((f) => f.path), ...uploaded];
      }
      const created = await api.post('/api/messages', {
        conversationType: selectedUser.type,
        conversationId: selectedUser.id,
        content: text || (atts.length ? 'Attachment' : ''),
        attachments: atts,
        replyTo: replyTo?.id || null,
      });
      setMessages((prev) => [...prev, created]);
      setText('');
      setAttachments([]);
      setReplyTo(null);
      await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleFiles = async (files) => {
    const list = Array.from(files || []);
    setAttachments((prev) => [...prev, ...list]);
  };

  const insertAtCursor = (emoji) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const next = text.slice(0, start) + emoji + text.slice(end);
      setText(next);
      setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + emoji.length; }, 0);
    } else {
      setText((t) => t + emoji);
    }
  };

  const handleReaction = async (msgId, emoji) => {
    try {
      const res = await api.post(`/api/messages/${msgId}/reactions`, { emoji });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: res.reactions } : m)));
    } catch {}
  };

  const handleEdit = async (msgId) => {
    try {
      const res = await api.put(`/api/messages/${msgId}`, { content: editText });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? res : m)));
      setEditingId(null);
      setEditText('');
    } catch {}
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/api/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {}
  };

  const handleCopy = (content) => {
    try { navigator.clipboard.writeText(content); } catch {}
  };

  const flatItems = sections.flatMap((s) => s.items);
  const filteredSections = sections.map((s) => ({
    ...s,
    items: s.items.filter((it) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (it.name || '').toLowerCase().includes(q) || (it.role || '').toLowerCase().includes(q);
    }),
  })).filter((s) => s.items.length > 0);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + (b || 0), 0);

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner"></div></div></div>;
  if (error) return <div className="page-container"><div className="empty-state">{error}</div></div>;

  return (
    <div className="page-container cm-root" style={{ padding: 0, '--cm-hover': T.hover }}>
      <style>{`
        .cm-root button { transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease; }
        .cm-root button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .cm-root button:active { transform: translateY(0); }
        .cm-root [data-conv]:hover { background: var(--cm-hover) !important; }
      `}</style>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, background: dark ? 'linear-gradient(90deg, rgba(37,99,235,0.12), rgba(99,102,241,0.08))' : 'linear-gradient(90deg, rgba(37,99,235,0.08), rgba(99,102,241,0.05))', borderRadius: 12, margin: '12px 12px 0' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: T.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <MessageCircleMore size={20} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Comments</div>
          <div style={{ fontSize: 13, color: T.muted }}>Manage conversations, discuss requests, and collaborate with your team.</div>
        </div>
      </div>
      <div className="cm-shell" style={{ display: 'flex', gap: 12, padding: 12, height: 'calc(100vh - 180px)', background: T.bg }}>
        {/* Left panel */}
        <div className="cm-left" style={{ display: 'flex', flexDirection: 'column', background: T.panel, borderRadius: 16, border: '1px solid ' + T.border, overflow: 'hidden', width: 340, flexShrink: 0 }}>
          <div style={{ padding: 16, borderBottom: '1px solid ' + T.border, background: T.surface }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: T.text }}>Conversations</h2>
              <button className="cm-new-btn" title="New conversation" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['all', 'unread', 'mentions'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid ' + T.border, background: filter === f ? T.accent : T.panel, color: filter === f ? T.panel : T.text2, cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>
                  {f} {f === 'all' ? `(${flatItems.length})` : f === 'unread' ? `(${totalUnread})` : ''}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.panel, borderRadius: 8, padding: '6px 10px', border: '1px solid ' + T.border, transition: 'border-color 0.2s, box-shadow 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = '0 0 0 3px ' + (dark ? 'rgba(59,130,246,0.15)' : 'rgba(8,102,245,0.12)'); }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}>
              <Icon name="search" size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: T.text }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {filteredSections.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.muted }}>No conversations</div>}
            {filteredSections.map((section) => (
              <div key={section.key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, padding: '8px 4px' }}>{section.title} ({section.items.length})</div>
                {section.items.map((it) => {
                  const key = it.type + ':' + it.id;
                  const isActive = selectedUser && selectedUser.type === it.type && selectedUser.id === it.id;
                  const unread = unreadMap[key] || 0;
                  if (filter === 'unread' && unread === 0) return null;
                  return (
                    <div key={key} data-conv onClick={() => openConversation(it)} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, cursor: 'pointer', background: isActive ? T.hover : 'transparent', marginBottom: 4, alignItems: 'center', transition: 'background 0.2s' }}>
                      <Avatar user={{ name: it.name, avatar: it.avatar }} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{it.name}</span>
                          <span style={{ fontSize: 11, color: T.muted }}>{it.time}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.accent }}>{ROLE_LABELS[it.role] || it.role}</div>
                        <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.last || 'No messages yet'}</div>
                      </div>
                      {unread > 0 && <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: T.accent, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{unread}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="cm-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.panel, borderRadius: 16, border: '1px solid ' + T.border, overflow: 'hidden', minWidth: 0 }}>
          {selectedUser ? (
            <>
              <div style={{ padding: 14, borderBottom: '1px solid ' + T.border, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar user={{ name: selectedUser.name, avatar: selectedUser.avatar }} size={44} />
                  <div>
                    <div style={{ fontWeight: 700, color: T.text }}>{selectedUser.name}</div>
                    <div style={{ fontSize: 12, color: T.text2 }}>{ROLE_LABELS[selectedUser.role] || selectedUser.role} · {selectedUser.online ? 'Online' : 'Offline'}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>ID: {selectedUser.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ padding: 8, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="Call">📞</button>
                  <button style={{ padding: 8, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="More">⋯</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: T.bg }}>
                {msgLoading && <div style={{ textAlign: 'center', color: T.muted }}>Loading...</div>}
                {!msgLoading && messages.length === 0 && <div style={{ textAlign: 'center', color: T.muted }}>No messages yet</div>}
                {messages.map((m, idx) => {
                  const d = new Date(m.created_at);
                  const dateStr = d.toLocaleDateString();
                  const prev = messages[idx - 1];
                  const prevDate = prev ? new Date(prev.created_at).toLocaleDateString() : null;
                  const own = m.sender_id === user?.id;
                  const replied = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
                  return (
                    <div key={m.id || idx}>
                      {dateStr !== prevDate && <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 11, color: T.muted }}>{dateStr}</div>}
                      <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', marginBottom: 10, gap: 8, alignItems: 'flex-end' }}>
                        {!own && <Avatar user={{ name: m.sender_name, avatar: m.sender_avatar }} size={32} />}
                        <div style={{ maxWidth: '72%' }}>
                          {replied && (
                            <div style={{ fontSize: 11, color: T.muted, background: T.hover, padding: '4px 8px', borderRadius: 8, marginBottom: 4, borderLeft: '3px solid #0866F5' }}>
                              ↩ {replied.content?.slice(0, 60)}
                            </div>
                          )}
                          {editingId === m.id ? (
                            <div>
                              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid ' + T.border }} />
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button onClick={() => handleEdit(m.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => { setEditingId(null); setEditText(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ position: 'relative', background: own ? (dark ? '#DBEAFE22' : '#EAF2FF') : (dark ? '#F1F5F922' : '#F3F4F6'), color: own ? (dark ? '#E2E8F0' : '#1E3A8A') : (dark ? '#E2E8F0' : '#1F2937'), padding: '10px 14px', borderRadius: 18, border: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : (dark ? '1px solid #475569' : '1px solid #E5E7EB'), boxShadow: own ? '0 4px 12px rgba(37,99,235,0.14)' : '0 4px 12px rgba(0,0,0,0.08)', backdropFilter: 'blur(2px)' }} onContextMenu={(e) => { e.preventDefault(); setContextMsg(m); }}>
                              {/* tail */}
                              <span style={{ position: 'absolute', bottom: -7, [own ? 'right' : 'left']: 16, width: 14, height: 14, background: 'inherit', transform: 'rotate(45deg)', borderRadius: 3, borderRight: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : 'none', borderBottom: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : 'none', borderLeft: !own ? (dark ? '1px solid #475569' : '1px solid #E5E7EB') : 'none', borderTop: !own ? (dark ? '1px solid #475569' : '1px solid #E5E7EB') : 'none', zIndex: 0, boxShadow: own ? '2px 2px 6px rgba(37,99,235,0.08)' : '2px 2px 6px rgba(0,0,0,0.05)' }} />
                              <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11, opacity: 0.9, flexWrap: 'wrap', textAlign: own ? 'right' : 'left', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                                  <span style={{ fontWeight: 700, color: own ? (dark ? '#BFDBFE' : '#1D4ED8') : (dark ? '#E2E8F0' : '#111827') }}>{own ? (m.sender_name || 'You') : (m.sender_name || 'Unknown')}</span>
                                  <span style={{ color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280'), fontWeight: 500 }}>{ROLE_LABELS[m.sender_role] || m.sender_role}</span>
                                  <span style={{ color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280') }}>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                  {m.edited_at && <span style={{ fontStyle: 'italic', color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280') }}>(edited)</span>}
                                </div>
                                <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</div>
                                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {m.attachments.map((a, i) => (
                                      <a key={i} href={a.path ? (process.env.REACT_APP_API_URL || '') + a.path : '#'} download target="_blank" rel="noreferrer" style={{ fontSize: 12, color: own ? (dark ? '#BFDBFE' : '#1D4ED8') : T.accent, textDecoration: 'underline' }}>
                                        📎 {a.name || 'file'} {a.size ? `(${Math.round(a.size / 1024)}KB)` : ''}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {Array.isArray(m.reactions) && m.reactions.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {m.reactions.map((r) => (
                                <button key={r.emoji} onClick={() => handleReaction(m.id, r.emoji)} style={{ padding: '2px 6px', borderRadius: 10, border: '1px solid ' + T.border, background: r.users.includes(user?.id) ? T.hover : T.panel, cursor: 'pointer', fontSize: 12 }}>
                                  {r.emoji} {r.users.length}
                                </button>
                              ))}
                            </div>
                          )}
                          {own && <div style={{ fontSize: 11, color: '#3B82F6', textAlign: 'right', marginTop: 2, display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>{m.read ? <><span>✓✓</span><span>Seen</span></> : <span>✓</span>}</div>}
                          {/* context menu */}
                          {contextMsg?.id === m.id && (
                            <div style={{ position: 'absolute', zIndex: 10, background: T.panel, border: '1px solid ' + T.border, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, marginTop: 4 }}>
                              {[
                                { label: 'Reply', action: () => { setReplyTo(m); setContextMsg(null); } },
                                { label: 'Copy', action: () => { handleCopy(m.content); setContextMsg(null); } },
                                { label: 'React 👍', action: () => { handleReaction(m.id, '👍'); setContextMsg(null); } },
                                ...(own ? [
                                  { label: 'Edit', action: () => { setEditingId(m.id); setEditText(m.content); setContextMsg(null); } },
                                  { label: 'Delete', action: () => { handleDelete(m.id); setContextMsg(null); } },
                                ] : []),
                              ].map((a) => (
                                <button key={a.label} onClick={a.action} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>{a.label}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        {own && <Avatar user={{ name: m.sender_name, avatar: m.sender_avatar }} size={32} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div style={{ padding: 12, borderTop: '1px solid ' + T.border, background: T.panel }}>
                {replyTo && (
                  <div style={{ fontSize: 12, color: T.text2, marginBottom: 6, padding: '4px 8px', background: T.surface, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Replying to: {replyTo.content?.slice(0, 40)}</span>
                    <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {attachments.map((f, i) => (
                      <div key={i} style={{ fontSize: 12, background: T.surface, padding: '4px 8px', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        📎 {f.name || f?.name}
                        <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadProgress > 0 && <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Uploading... {uploadProgress}%</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div ref={attachRef} style={{ position: 'relative' }} onMouseEnter={() => setShowAttachMenu(true)} onMouseLeave={() => setShowAttachMenu(false)}>
                     <button style={{ padding: 10, borderRadius: 10, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="Attach"><Paperclip size={18} color={T.text2} /></button>
                     {showAttachMenu && (
                       <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, background: T.panel, border: '1px solid ' + T.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 6, zIndex: 60, minWidth: 190 }}>
                         {[
                           { label: 'Photos', icon: <ImageIcon size={16} color="#2B547E" />, accept: 'image/*' },
                           { label: 'Videos', icon: <Video size={16} color="#2B547E" />, accept: 'video/*' },
                           { label: 'Documents', icon: <FileText size={16} color="#2B547E" />, accept: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,application/pdf' },
                           { label: 'Music / Audio', icon: <Music size={16} color="#2B547E" />, accept: 'audio/*' },
                           { label: 'Other Files', icon: <Paperclip size={16} color="#2B547E" />, accept: '*/*' },
                         ].map((opt) => (
                           <button key={opt.label} onClick={() => { setAcceptType(opt.accept); setShowAttachMenu(false); setTimeout(() => fileInputRef.current && fileInputRef.current.click(), 0); }}
                             style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, color: T.text, fontSize: 13, textAlign: 'left' }}
                             onMouseEnter={(e) => { e.currentTarget.style.background = T.hover; }}
                             onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                             {opt.icon} {opt.label}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Write a message..."
                    rows={1}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid ' + T.border, resize: 'none', fontSize: 14, background: T.input, color: T.text, transition: 'border-color 0.2s, box-shadow 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = '0 0 0 3px ' + (dark ? 'rgba(59,130,246,0.15)' : 'rgba(8,102,245,0.12)'); }}
                    onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; } }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = '0 0 0 3px ' + (dark ? 'rgba(59,130,246,0.2)' : 'rgba(8,102,245,0.15)'); }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <div ref={emojiRef} style={{ position: 'relative' }} onMouseEnter={() => setShowEmojiPicker(true)} onMouseLeave={() => setShowEmojiPicker(false)}>
                     <button style={{ padding: 10, borderRadius: 10, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="Emoji"><Smile size={18} color={T.text2} /></button>
                     {showEmojiPicker && (
                       <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, background: T.panel, border: '1px solid ' + T.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 320, maxHeight: 360, overflow: 'hidden', zIndex: 60, display: 'flex', flexDirection: 'column' }}>
                         <div style={{ display: 'flex', borderBottom: '1px solid ' + T.border, background: T.surface }}>
                           {['stickers','emoji','more'].map((tab) => (
                             <button key={tab} onClick={() => setEmojiTab(tab)}
                               style={{ flex: 1, padding: '8px 4px', border: 'none', background: emojiTab === tab ? T.panel : 'transparent', color: emojiTab === tab ? '#2B547E' : T.text2, cursor: 'pointer', fontWeight: 600, fontSize: 12, borderBottom: emojiTab === tab ? '2px solid #2B547E' : '2px solid transparent' }}>
                               {tab === 'stickers' ? 'Stickers' : tab === 'emoji' ? 'Emoji' : 'More'}
                             </button>
                           ))}
                         </div>
                         <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                           {emojiTab === 'stickers' && (
                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                               {['🎉','🎊','🥳','😍','😎','🤩','🔥','💪','👍','❤️','💯','✨','🚀','🎯','🏆','🌟','👏','🙌','🫶','💖','🎁','🎈','🌈','⭐'].map((s, i) => (
                                 <button key={i} onClick={() => { insertAtCursor(s); setShowEmojiPicker(false); }}
                                   style={{ fontSize: 28, border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 8 }}
                                   onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.background = T.hover; }}
                                   onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'transparent'; }}>
                                   {s}
                                 </button>
                               ))}
                             </div>
                           )}
                           {emojiTab === 'emoji' && (
                             <div>
                               <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, background: T.input, borderRadius: 8, padding: '4px 8px', border: '1px solid ' + T.border }}>
                                 <Search size={14} color={T.muted} />
                                 <input value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} placeholder="Search emoji..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, background: 'transparent', color: T.text }} />
                               </div>
                               {[
                                 { name: 'Smileys', items: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😱','😨','😰','😥','😓'] },
                                 { name: 'Gestures', items: ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤝','🙏','👏','🙌','👐','🤲'] },
                                 { name: 'Symbols', items: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✅','❌','⭐','🔥','✨','💯','⚡','🎉','🎊'] },
                               ].map((cat) => {
                                 const filtered = emojiSearch ? cat.items.filter((e) => e.includes(emojiSearch)) : cat.items;
                                 if (emojiSearch && filtered.length === 0) return null;
                                 return (
                                   <div key={cat.name} style={{ marginBottom: 8 }}>
                                     <div style={{ fontSize: 11, fontWeight: 700, color: T.text2, marginBottom: 4 }}>{cat.name}</div>
                                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                       {filtered.map((e, i) => (
                                         <button key={i} onClick={() => { insertAtCursor(e); setShowEmojiPicker(false); }}
                                           style={{ fontSize: 18, border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, borderRadius: 6 }}
                                           onMouseEnter={(ev) => { ev.currentTarget.style.background = T.hover; }}
                                           onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}>
                                           {e}
                                         </button>
                                       ))}
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           )}
                           {emojiTab === 'more' && (
                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                               {['👍','❤️','😂','😮','😢','😡','🎉','🔥','👏','🙏','💯','✅','❌','⭐','💬','📌'].map((r, i) => (
                                 <button key={i} onClick={() => { insertAtCursor(r); setShowEmojiPicker(false); }}
                                   style={{ fontSize: 22, border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 8 }}
                                   onMouseEnter={(e) => { e.currentTarget.style.background = T.hover; }}
                                   onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                   {r}
                                 </button>
                               ))}
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                  <button onClick={send} disabled={sending || (!text.trim() && attachments.length === 0)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer', opacity: (sending || (!text.trim() && attachments.length === 0)) ? 0.5 : 1 }}>Send</button>
                </div>
                {showEmoji && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {['😀','😊','😂','😍','😎','🤔','👍','🙏','🔥','🎉','❤️','✅','📌','📎','💬','⭐'].map((e) => (
                      <button key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} accept={acceptType} style={{ display: "none" }} multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted }}>Select a conversation</div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildSections(role, me, users, groups) {
  const byRole = (r) => users.filter((u) => u.role === r && u.id !== me?.id);
  const sections = [];
  if (role === 'admin') {
    sections.push({ key: 'dev', title: 'Developers', count: byRole('developer').length, items: byRole('developer').map(toItem('direct')) });
    sections.push({ key: 'esc', title: 'Escalation Team', count: byRole('support').length, items: byRole('support').map(toItem('direct')) });
    sections.push({ key: 'cli', title: 'Clients', count: byRole('client').length, items: byRole('client').map(toItem('direct')) });
    sections.push({ key: 'usr', title: 'Users', count: users.filter((u) => !['admin','developer','support','client'].includes(u.role) && u.id !== me?.id).length, items: users.filter((u) => !['admin','developer','support','client'].includes(u.role) && u.id !== me?.id).map(toItem('direct')) });
  } else if (role === 'client') {
    const admins = byRole('admin');
    sections.push({ key: 'adm', title: 'Admin', count: admins.length, items: admins.map(toItem('direct')) });
  } else if (role === 'developer') {
    const sameGroupDevs = users.filter((u) => u.role === 'developer' && u.id !== me?.id && sharesGroup(u, me, groups));
    sections.push({ key: 'dev', title: 'Developers', count: sameGroupDevs.length, items: sameGroupDevs.map(toItem('direct')) });
    const esc = byRole('support');
    sections.push({ key: 'esc', title: 'Escalation Team', count: esc.length, items: esc.map(toItem('direct')) });
    const myGroups = groups.filter((g) => isMember(g, me?.id));
    myGroups.forEach((g) => {
      sections.unshift({ key: 'grp-' + g.id, title: g.name, count: (g.members || []).length, items: [{ id: g.id, type: 'group', name: g.name, role: 'Group Chat', members: (g.members || []).map((mid) => users.find((u) => u.id === mid)).filter(Boolean), avatar: null, last: '', time: '', online: true }] });
    });
  } else if (role === 'support') {
    const esc = byRole('support').filter((u) => u.id !== me?.id);
    sections.push({ key: 'esc', title: 'Escalation Team', count: esc.length, items: esc.map(toItem('direct')) });
    const devs = byRole('developer');
    sections.push({ key: 'dev', title: 'Developers', count: devs.length, items: devs.map(toItem('direct')) });
  }
  sections.forEach((s) => {
    s.items = s.items.map((it) => ({
      type: it.type || 'direct',
      id: it.id,
      name: it.name,
      role: it.role,
      members: it.members,
      avatar: it.avatar,
      online: it.online || false,
      last: it.last || '',
      time: it.time || '',
    }));
  });
  return sections.filter((s) => s.items && s.items.length > 0);
}

function toItem(type) {
  return (u) => ({ type, id: u.id, name: u.name, role: u.role, avatar: u.avatar, online: u.online || u.status === 'online' || u.isOnline, members: null, last: '', time: '' });
}

function sharesGroup(u, me, groups) {
  if (!groups || groups.length === 0) return true;
  const uGroups = groups.filter((g) => Array.isArray(g.members) && g.members.includes(u.id)).map((g) => g.id);
  const mGroups = groups.filter((g) => Array.isArray(g.members) && g.members.includes(me?.id)).map((g) => g.id);
  if (uGroups.length === 0 || mGroups.length === 0) return true;
  return uGroups.some((g) => mGroups.includes(g));
}

function isMember(g, uid) {
  if (!g) return false;
  if (Array.isArray(g.members)) return g.members.includes(uid);
  return false;
}



