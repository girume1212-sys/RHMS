import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const { user } = useAuth();
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
    <div className="page-container" style={{ padding: 0 }}>
      <div className="cm-shell" style={{ display: 'flex', gap: 12, padding: 12, height: 'calc(100vh - 120px)' }}>
        {/* Left panel */}
        <div className="cm-left" style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, border: '1px solid #D7E3FF', overflow: 'hidden', width: 340, flexShrink: 0 }}>
          <div style={{ padding: 16, borderBottom: '1px solid #D7E3FF', background: '#EFF4FF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#102B65' }}>Conversations</h2>
              <button className="cm-new-btn" title="New conversation" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#0866F5', color: '#fff', cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['all', 'unread', 'mentions'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #D7E3FF', background: filter === f ? '#0866F5' : '#fff', color: filter === f ? '#fff' : '#38558D', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>
                  {f} {f === 'all' ? `(${flatItems.length})` : f === 'unread' ? `(${totalUnread})` : ''}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '6px 10px', border: '1px solid #D7E3FF' }}>
              <Icon name="search" size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {filteredSections.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No conversations</div>}
            {filteredSections.map((section) => (
              <div key={section.key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#38558D', padding: '8px 4px' }}>{section.title} ({section.items.length})</div>
                {section.items.map((it) => {
                  const key = it.type + ':' + it.id;
                  const isActive = selectedUser && selectedUser.type === it.type && selectedUser.id === it.id;
                  const unread = unreadMap[key] || 0;
                  if (filter === 'unread' && unread === 0) return null;
                  return (
                    <div key={key} onClick={() => openConversation(it)} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, cursor: 'pointer', background: isActive ? '#EAF1FF' : 'transparent', marginBottom: 4, alignItems: 'center' }}>
                      <Avatar user={{ name: it.name, avatar: it.avatar }} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#102B65' }}>{it.name}</span>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>{it.time}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#0866F5' }}>{ROLE_LABELS[it.role] || it.role}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.last || 'No messages yet'}</div>
                      </div>
                      {unread > 0 && <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#0866F5', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{unread}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="cm-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, border: '1px solid #D7E3FF', overflow: 'hidden', minWidth: 0 }}>
          {selectedUser ? (
            <>
              <div style={{ padding: 14, borderBottom: '1px solid #D7E3FF', background: '#EFF4FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar user={{ name: selectedUser.name, avatar: selectedUser.avatar }} size={44} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#102B65' }}>{selectedUser.name}</div>
                    <div style={{ fontSize: 12, color: '#38558D' }}>{ROLE_LABELS[selectedUser.role] || selectedUser.role} · {selectedUser.online ? 'Online' : 'Offline'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>ID: {selectedUser.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ padding: 8, borderRadius: 8, border: '1px solid #D7E3FF', background: '#fff', cursor: 'pointer' }} title="Call">📞</button>
                  <button style={{ padding: 8, borderRadius: 8, border: '1px solid #D7E3FF', background: '#fff', cursor: 'pointer' }} title="More">⋯</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#F8FAFF' }}>
                {msgLoading && <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>}
                {!msgLoading && messages.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280' }}>No messages yet</div>}
                {messages.map((m, idx) => {
                  const d = new Date(m.created_at);
                  const dateStr = d.toLocaleDateString();
                  const prev = messages[idx - 1];
                  const prevDate = prev ? new Date(prev.created_at).toLocaleDateString() : null;
                  const own = m.sender_id === user?.id;
                  const replied = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
                  return (
                    <div key={m.id || idx}>
                      {dateStr !== prevDate && <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 11, color: '#6b7280' }}>{dateStr}</div>}
                      <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', marginBottom: 10, gap: 8, alignItems: 'flex-end' }}>
                        {!own && <Avatar user={{ name: m.sender_name, avatar: m.sender_avatar }} size={32} />}
                        <div style={{ maxWidth: '70%' }}>
                          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2, textAlign: own ? 'right' : 'left' }}>
                            {!own && <span style={{ fontWeight: 600, color: '#102B65', marginRight: 6 }}>{m.sender_name}</span>}
                            {ROLE_LABELS[m.sender_role] || m.sender_role}
                            <span style={{ marginLeft: 6 }}>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            {m.edited_at && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(edited)</span>}
                          </div>
                          {replied && (
                            <div style={{ fontSize: 11, color: '#6b7280', background: '#EAF1FF', padding: '4px 8px', borderRadius: 8, marginBottom: 4, borderLeft: '3px solid #0866F5' }}>
                              ↩ {replied.content?.slice(0, 60)}
                            </div>
                          )}
                          {editingId === m.id ? (
                            <div>
                              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #D7E3FF' }} />
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button onClick={() => handleEdit(m.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0866F5', color: '#fff', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => { setEditingId(null); setEditText(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D7E3FF', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ background: own ? 'linear-gradient(110deg, #0875F9 0%, #2563EB 100%)' : '#E9EDFA', color: own ? '#fff' : '#102B65', padding: '8px 12px', borderRadius: 12, position: 'relative' }} onContextMenu={(e) => { e.preventDefault(); setContextMsg(m); }}>
                              {m.content}
                              {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {m.attachments.map((a, i) => (
                                    <a key={i} href={a.path ? (process.env.REACT_APP_API_URL || '') + a.path : '#'} download target="_blank" rel="noreferrer" style={{ fontSize: 12, color: own ? '#fff' : '#0866F5', textDecoration: 'underline' }}>
                                      📎 {a.name || 'file'} {a.size ? `(${Math.round(a.size / 1024)}KB)` : ''}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {Array.isArray(m.reactions) && m.reactions.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {m.reactions.map((r) => (
                                <button key={r.emoji} onClick={() => handleReaction(m.id, r.emoji)} style={{ padding: '2px 6px', borderRadius: 10, border: '1px solid #D7E3FF', background: r.users.includes(user?.id) ? '#DBEAFE' : '#fff', cursor: 'pointer', fontSize: 12 }}>
                                  {r.emoji} {r.users.length}
                                </button>
                              ))}
                            </div>
                          )}
                          {own && <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right', marginTop: 2 }}>✓✓</div>}
                          {/* context menu */}
                          {contextMsg?.id === m.id && (
                            <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #D7E3FF', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 4, marginTop: 4 }}>
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
              <div style={{ padding: 12, borderTop: '1px solid #D7E3FF', background: '#fff' }}>
                {replyTo && (
                  <div style={{ fontSize: 12, color: '#38558D', marginBottom: 6, padding: '4px 8px', background: '#EFF4FF', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Replying to: {replyTo.content?.slice(0, 40)}</span>
                    <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {attachments.map((f, i) => (
                      <div key={i} style={{ fontSize: 12, background: '#EFF4FF', padding: '4px 8px', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        📎 {f.name || f?.name}
                        <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadProgress > 0 && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Uploading... {uploadProgress}%</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => { setAcceptType('*/*'); setTimeout(() => fileInputRef.current && fileInputRef.current.click(), 0); }} style={{ padding: 10, borderRadius: 10, border: '1px solid #D7E3FF', background: '#fff', cursor: 'pointer' }} title="Attach">📎</button>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Write a message..."
                    rows={1}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #D7E3FF', resize: 'none', fontSize: 14 }}
                  />
                  <button onClick={() => setShowEmoji((s) => !s)} style={{ padding: 10, borderRadius: 10, border: '1px solid #D7E3FF', background: '#fff', cursor: 'pointer' }} title="Emoji">😊</button>
                  <button onClick={send} disabled={sending || (!text.trim() && attachments.length === 0)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#0866F5', color: '#fff', cursor: 'pointer', opacity: (sending || (!text.trim() && attachments.length === 0)) ? 0.5 : 1 }}>Send</button>
                </div>
                {showEmoji && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {['😀','😊','😂','😍','😎','🤔','👍','🙏','🔥','🎉','❤️','✅','📌','📎','💬','⭐'].map((e) => (
                      <button key={e} onClick={() => { setText((t) => t + e); setShowEmoji(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Select a conversation</div>
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