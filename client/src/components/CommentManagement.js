import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Icon from './Icon';

const COLORS = {
  navy: '#102B65',
  royal: '#0866F5',
  secondary: '#2563EB',
  pale: '#EFF4FF',
  incoming: '#E9EDFA',
  border: '#D7E3FF',
  white: '#FFFFFF',
  secondaryText: '#38558D',
  unread: '#0866F5',
  notif: '#EF2929',
};

function avatarUrl(u) {
  if (!u) return null;
  return u.avatar || null;
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase() || '?';
}

function Avatar({ user, size = 40 }) {
  const url = avatarUrl(user);
  if (url) {
    return <img src={url} alt={user?.name || ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(110deg, #0875F9 0%, #2563EB 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.38 }}>
      {initials(user?.name)}
    </div>
  );
}

export default function CommentManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null); // selected conversation/user in right panel
  const [attachments, setAttachments] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [acceptType, setAcceptType] = useState('*/*');
  const fileInputRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const messagesEndRef = useRef(null);
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

  // build sidebar sections
  const sections = buildSections(role, user, users, groups);

  const openConversation = useCallback(async (conv) => {
    setSelectedUser(conv);
    setMessages([]);
    setText('');
    setAttachments([]);
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

  // polling for new messages
  useEffect(() => {
    if (!selectedUser) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.get(`/api/messages?conversationType=${selectedUser.type}&conversationId=${encodeURIComponent(selectedUser.id)}`);
        if (Array.isArray(data) && data.length !== messages.length) {
          setMessages(data);
          await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [selectedUser, messages.length]);

  const send = async () => {
    if ((!text.trim() && attachments.length === 0) || !selectedUser) return;
    setSending(true);
    try {
      const created = await api.post('/api/messages', {
        conversationType: selectedUser.type,
        conversationId: selectedUser.id,
        content: text,
        attachments: [],
      });
      setMessages((prev) => [...prev, created]);
      setText('');
      await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
    } catch (e) {
      // ignore
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

  // compute unread counts for sidebar (best-effort)
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
  }, [loading, sections.length, selectedUser]);

  if (loading) {
    return <div className="page-container"><div className="loading-screen"><div className="spinner"></div></div></div>;
  }
  if (error) {
    return <div className="page-container"><div className="empty-state">{error}</div></div>;
  }

  const filteredSections = sections.map((s) => ({
    ...s,
    items: s.items.filter((it) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (it.name || '').toLowerCase().includes(q) || (it.role || '').toLowerCase().includes(q);
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <div className="cm-shell">
        {/* Left sidebar */}
        <div className="cm-left">
          <div className="cm-left-header">
            <h2 className="cm-title">Conversations</h2>
            <button className="cm-new-btn" title="New conversation">+</button>
          </div>
          <div className="cm-search">
            <Icon name="search" size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." />
          </div>
          <div className="cm-sort">Newest ▾</div>
          <div className="cm-list">
            {filteredSections.length === 0 && <div className="cm-empty">No conversations</div>}
            {filteredSections.map((section) => (
              <SidebarSection key={section.key} section={section} selected={selectedUser} onSelect={openConversation} unreadMap={unreadMap} />
            ))}
          </div>
        </div>

        {/* Right workspace */}
        <div className="cm-right" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {selectedUser ? (
            <ChatHeader selected={selectedUser} />
          ) : (
            <ChatHeader selected={{ name: 'Select a conversation', role: '', type: 'direct' }} />
          )}
          {selectedUser && selectedUser.type === 'group' && selectedUser.members && selectedUser.members.length > 0 && (
            <MemberStrip members={selectedUser.members} />
          )}
          <div className="cm-messages" style={{ flex: 1, minHeight: 0 }}>
            {msgLoading && <div className="cm-empty">Loading...</div>}
            {!msgLoading && selectedUser && messages.length === 0 && <div className="cm-empty">No messages yet</div>}
            {!selectedUser && !msgLoading && <div className="cm-empty">Select a conversation</div>}
            {selectedUser && renderMessages(messages, user)}
            <div ref={messagesEndRef} />
          </div>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept={acceptType} onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setAttachments((prev) => [...prev, ...files]);
            e.target.value = '';
            setShowAttachMenu(false);
          }} />
          <Composer text={text} setText={setText} onSend={send} sending={sending} onKeyDown={handleKey}
            onAttachClick={() => { setAcceptType('*/*'); setTimeout(() => fileInputRef.current && fileInputRef.current.click(), 0); }}
            onAttachHover={setShowAttachMenu}
            showAttachMenu={showAttachMenu}
            onSelectAttachType={(accept) => { setAcceptType(accept); setShowAttachMenu(false); setTimeout(() => fileInputRef.current && fileInputRef.current.click(), 0); }}
            onEmoji={() => setShowEmoji((s) => !s)}
            showEmoji={showEmoji}
            attachments={attachments}
            onRemoveAttachment={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} />
          {showEmoji && (
            <div className="cm-emoji-panel">
              {['😀','😊','😂','😍','😎','🤔','👍','🙏','🔥','🎉','❤️','✅','📌','📎','💬','⭐'].map((e) => (
                <button key={e} className="cm-emoji-item" onClick={() => { setText((t) => t + e); setShowEmoji(false); }}>{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildSections(role, me, users, groups) {
  const byRole = (r) => users.filter((u) => u.role === r && u.id !== me?.id);
  const myGroupIds = new Set((groups || []).filter((g) => Array.isArray(g.members) ? g.members.includes(me?.id) : false).map((g) => g.id));
  // fallback: infer membership via user_groups not provided; use groups with members
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
    // same-group developers
    const sameGroupDevs = users.filter((u) => u.role === 'developer' && u.id !== me?.id && sharesGroup(u, me, groups));
    sections.push({ key: 'dev', title: 'Developers', count: sameGroupDevs.length, items: sameGroupDevs.map(toItem('direct')) });
    const esc = byRole('support');
    sections.push({ key: 'esc', title: 'Escalation Team', count: esc.length, items: esc.map(toItem('direct')) });
    // group chat entry
    const myGroups = groups.filter((g) => isMember(g, me?.id));
    myGroups.forEach((g) => {
      sections.unshift({ key: 'grp-' + g.id, title: g.name, count: (g.members || []).length, items: [{ id: g.id, type: 'group', name: g.name, role: 'Group Chat', members: (g.members || []).map((mid) => users.find((u) => u.id === mid)).filter(Boolean), avatar: null, last: '', time: '' }] });
    });
  } else if (role === 'support') {
    const esc = byRole('support').filter((u) => u.id !== me?.id);
    sections.push({ key: 'esc', title: 'Escalation Team', count: esc.length, items: esc.map(toItem('direct')) });
    const devs = byRole('developer');
    sections.push({ key: 'dev', title: 'Developers', count: devs.length, items: devs.map(toItem('direct')) });
  }
  // ensure item shape
  sections.forEach((s) => {
    s.items = s.items.map((it) => ({
      type: it.type || 'direct',
      id: it.id,
      name: it.name,
      role: it.role,
      members: it.members,
      avatar: it.avatar,
      online: it.online,
      last: it.last || '',
      time: it.time || '',
    }));
  });
  // remove empty sections
  return sections.filter((s) => s.items && s.items.length > 0 || true);
}

function toItem(type) {
  return (u) => ({ type, id: u.id, name: u.name, role: u.role, avatar: u.avatar, online: u.online || u.status === 'online' || u.isOnline, members: null, last: '', time: '' });
}

function sharesGroup(u, me, groups) {
  // groups may not include members; fallback true for demo
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

const GRADIENTS = {
  Developers: 'linear-gradient(120deg, #DBEAFE 0%, #E0E7FF 100%)',
  'Escalation Team': 'linear-gradient(120deg, #CCFBF1 0%, #DBEAFE 100%)',
  Clients: 'linear-gradient(120deg, #FEF3C7 0%, #FFEDD5 100%)',
  Users: 'linear-gradient(120deg, #F3E8FF 0%, #E0E7FF 100%)',
};

function SidebarSection({ section, selected, onSelect, unreadMap }) {
  const [open, setOpen] = useState(true);
  const grad = GRADIENTS[section.title] || 'linear-gradient(120deg, #DBEAFE 0%, #E0E7FF 100%)';
  return (
    <div className="cm-section">
      <div className="cm-section-header" onClick={() => setOpen((o) => !o)}>
        <span className="cm-section-title">{section.title}({section.count ?? section.items.length})</span>
        <span className="cm-section-arrow">
          {open ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38558D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38558D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          )}
        </span>
      </div>
      {open && (
        <div className="cm-grad-container" style={{ background: grad }}>
          {section.items.map((it) => {
            const key = it.type + ':' + it.id;
            const isActive = selected && selected.type === it.type && selected.id === it.id;
            const unread = unreadMap[key] || 0;
            return (
              <div key={key} className={`cm-conv ${isActive ? 'active' : ''}`} onClick={() => onSelect(it)}>
                <div className="cm-avatar-wrap">
                  {it.type === 'group' ? (
                    <div className="cm-avatar group">G</div>
                  ) : (
                    <Avatar user={{ name: it.name, avatar: it.avatar }} size={40} />
                  )}
                </div>
                <div className="cm-conv-body">
                  <div className="cm-conv-name">{it.name}</div>
                  <div className="cm-conv-role">{it.role}</div>
                  <div className="cm-conv-preview">{it.last || 'No messages yet'}</div>
                </div>
                <div className="cm-conv-right">
                  <div className="cm-conv-time">{it.time}</div>
                  {unread > 0 && <div className="cm-unread">{unread}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatHeader({ selected }) {
  const status = selected?.online === true ? 'Online' : (selected?.online === false ? 'Offline' : null);
  return (
    <div className="cm-header">
      <div className="cm-header-left">
        {selected?.type === 'group' ? (
          <div className="cm-header-avatar group">G</div>
        ) : (
          <Avatar user={{ name: selected?.name, avatar: selected?.avatar }} size={44} />
        )}
        <div>
          <div className="cm-header-name">{selected?.name}</div>
          <div className="cm-header-sub">
            {selected?.type === 'group' ? 'Group Chat' : [selected?.role, status].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      <div className="cm-header-actions">
        <button className="cm-icon-btn" title="Voice call">📞</button>
        <button className="cm-icon-btn" title="Video call">📹</button>
        <button className="cm-icon-btn" title="More">⋯</button>
      </div>
    </div>
  );
}

function MemberStrip({ members }) {
  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;
  return (
    <div className="cm-members">
      {shown.map((m) => (
        <div key={m.id} className="cm-member">
          <Avatar user={m} size={28} />
          <div className="cm-member-info">
            <div className="cm-member-name">{m.name}</div>
            <div className="cm-member-role">{m.role}</div>
          </div>
        </div>
      ))}
      {extra > 0 && <div className="cm-member-extra">+{extra}</div>}
    </div>
  );
}

function renderMessages(messages, me) {
  let lastDate = null;
  const out = [];
  messages.forEach((m, idx) => {
    const d = new Date(m.created_at);
    const dateStr = d.toLocaleDateString();
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      out.push(<div key={'date-' + idx} className="cm-date-sep">{dateStr}</div>);
    }
    const own = m.sender_id === me?.id;
    out.push(
      <div key={m.id || idx} className={`cm-msg ${own ? 'out' : 'in'}`}>
        {!own && <div className="cm-msg-avatar"><Avatar user={{ name: m.sender_name, avatar: m.sender_avatar }} size={32} /></div>}
        <div className="cm-msg-col">
          <div className="cm-msg-meta">
            <span className="cm-msg-sender">{m.sender_name || 'Unknown'}</span>
            <span className="cm-msg-time">{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <div className="cm-bubble">{m.content}</div>
          {own && <div className="cm-checks">✓✓</div>}
        </div>
        {own && <div className="cm-msg-avatar"><Avatar user={{ name: m.sender_name, avatar: m.sender_avatar }} size={32} /></div>}
      </div>
    );
  });
  return out;
}

function Composer({ text, setText, onSend, sending, onKeyDown }) {
  return (
    <div className="cm-composer">
      <button className="cm-plus-btn" title="Add">+</button>
      <textarea
        className="cm-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write a message..."
        rows={1}
      />
      <button className="cm-attach-btn" title="Attach">📎</button>
      <button className="cm-emoji-btn" title="Emoji">😊</button>
      <button className="cm-send-btn" onClick={onSend} disabled={sending || !text.trim()}>➤</button>
    </div>
  );
}
