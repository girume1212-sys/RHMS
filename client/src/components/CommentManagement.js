import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircleMore, Image as ImageIcon, Video, FileText, Music, Paperclip, Smile, Search, ShieldCheck, Copy, Pencil, Trash2, Reply, Code2, Headset, UsersRound, ChevronDown } from 'lucide-react';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { showStatusToast } from '../notify';
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

// Pastel, role-specific design tokens used by the left-hand directory panel.
// Each role has a light and a dark variant so the panel stays readable in both themes.
const ROLE_THEMES = {
  admin: {
    Icon: ShieldCheck,
    description: 'Full system access and oversight',
    light: {
      gradient: 'linear-gradient(135deg, #F5F0FF 0%, #E6DBFC 100%)',
      border: '#DFD2F7',
      accent: '#6D28D9',
      iconBg: 'rgba(255,255,255,0.76)',
      countBg: 'rgba(255,255,255,0.88)',
      rowHover: '#F8F4FF',
      rowSelected: '#F1E9FF',
      rowSelectedBorder: '#D9C8FA',
    },
    dark: {
      gradient: 'linear-gradient(135deg, rgba(124,58,237,0.24) 0%, rgba(76,29,149,0.14) 100%)',
      border: 'rgba(167,139,250,0.30)',
      accent: '#C4B5FD',
      iconBg: 'rgba(124,58,237,0.22)',
      countBg: 'rgba(124,58,237,0.24)',
      rowHover: 'rgba(124,58,237,0.10)',
      rowSelected: 'rgba(124,58,237,0.17)',
      rowSelectedBorder: 'rgba(167,139,250,0.36)',
    },
  },
  developer: {
    Icon: Code2,
    description: 'Build and maintain solutions',
    light: {
      gradient: 'linear-gradient(135deg, #EFF7FF 0%, #DCEBFF 100%)',
      border: '#D2E3FA',
      accent: '#1D4ED8',
      iconBg: 'rgba(255,255,255,0.78)',
      countBg: 'rgba(255,255,255,0.88)',
      rowHover: '#F2F8FF',
      rowSelected: '#E8F2FF',
      rowSelectedBorder: '#C7DFFC',
    },
    dark: {
      gradient: 'linear-gradient(135deg, rgba(37,99,235,0.24) 0%, rgba(29,78,216,0.13) 100%)',
      border: 'rgba(96,165,250,0.30)',
      accent: '#93C5FD',
      iconBg: 'rgba(37,99,235,0.22)',
      countBg: 'rgba(37,99,235,0.24)',
      rowHover: 'rgba(37,99,235,0.10)',
      rowSelected: 'rgba(37,99,235,0.17)',
      rowSelectedBorder: 'rgba(96,165,250,0.36)',
    },
  },
  support: {
    Icon: Headset,
    description: 'Resolve escalated requests',
    light: {
      gradient: 'linear-gradient(135deg, #EAFAF3 0%, #D3F3E5 100%)',
      border: '#C8EDDC',
      accent: '#047857',
      iconBg: 'rgba(255,255,255,0.78)',
      countBg: 'rgba(255,255,255,0.88)',
      rowHover: '#F0FCF7',
      rowSelected: '#E3F8EF',
      rowSelectedBorder: '#BEEAD7',
    },
    dark: {
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(5,150,105,0.12) 100%)',
      border: 'rgba(52,211,153,0.30)',
      accent: '#6EE7B7',
      iconBg: 'rgba(16,185,129,0.20)',
      countBg: 'rgba(16,185,129,0.22)',
      rowHover: 'rgba(16,185,129,0.09)',
      rowSelected: 'rgba(16,185,129,0.16)',
      rowSelectedBorder: 'rgba(52,211,153,0.36)',
    },
  },
  client: {
    Icon: UsersRound,
    description: 'Requesters and customers',
    light: {
      gradient: 'linear-gradient(135deg, #FFF5EC 0%, #FFE4D0 100%)',
      border: '#F7DCC2',
      accent: '#C2410C',
      iconBg: 'rgba(255,255,255,0.78)',
      countBg: 'rgba(255,255,255,0.88)',
      rowHover: '#FFF8F2',
      rowSelected: '#FFF0E3',
      rowSelectedBorder: '#F6D3B4',
    },
    dark: {
      gradient: 'linear-gradient(135deg, rgba(249,115,22,0.20) 0%, rgba(194,65,12,0.12) 100%)',
      border: 'rgba(251,146,60,0.30)',
      accent: '#FDBA74',
      iconBg: 'rgba(249,115,22,0.18)',
      countBg: 'rgba(249,115,22,0.20)',
      rowHover: 'rgba(249,115,22,0.08)',
      rowSelected: 'rgba(249,115,22,0.15)',
      rowSelectedBorder: 'rgba(251,146,60,0.34)',
    },
  },
  group: {
    Icon: MessageCircleMore,
    description: 'Team conversation',
    light: {
      gradient: 'linear-gradient(135deg, #F5F8FD 0%, #E9F0FA 100%)',
      border: '#E0E8F4',
      accent: '#3B5B8C',
      iconBg: 'rgba(255,255,255,0.80)',
      countBg: 'rgba(255,255,255,0.90)',
      rowHover: '#F5F8FD',
      rowSelected: '#ECF2FB',
      rowSelectedBorder: '#D3E1F3',
    },
    dark: {
      gradient: 'linear-gradient(135deg, rgba(71,85,105,0.24) 0%, rgba(51,65,85,0.14) 100%)',
      border: 'rgba(148,163,184,0.28)',
      accent: '#CBD5E1',
      iconBg: 'rgba(148,163,184,0.16)',
      countBg: 'rgba(148,163,184,0.18)',
      rowHover: 'rgba(148,163,184,0.08)',
      rowSelected: 'rgba(148,163,184,0.15)',
      rowSelectedBorder: 'rgba(148,163,184,0.32)',
    },
  },
  user: {
    Icon: UsersRound,
    description: 'Other platform members',
    light: {
      gradient: 'linear-gradient(135deg, #F7F9FC 0%, #EDF2F9 100%)',
      border: '#E3EAF4',
      accent: '#516784',
      iconBg: 'rgba(255,255,255,0.80)',
      countBg: 'rgba(255,255,255,0.90)',
      rowHover: '#F7FAFE',
      rowSelected: '#EEF4FB',
      rowSelectedBorder: '#D8E4F2',
    },
    dark: {
      gradient: 'linear-gradient(135deg, rgba(100,116,139,0.22) 0%, rgba(71,85,105,0.12) 100%)',
      border: 'rgba(148,163,184,0.24)',
      accent: '#CBD5E1',
      iconBg: 'rgba(100,116,139,0.18)',
      countBg: 'rgba(100,116,139,0.20)',
      rowHover: 'rgba(148,163,184,0.07)',
      rowSelected: 'rgba(148,163,184,0.13)',
      rowSelectedBorder: 'rgba(148,163,184,0.28)',
    },
  },
};

function sectionThemeKey(section) {
  const key = String(section?.key || '');
  if (section?.special || key === 'adm' || key === 'admin-support') return 'admin';
  if (key === 'dev') return 'developer';
  if (key === 'esc') return 'support';
  if (key === 'cli') return 'client';
  if (key.startsWith('grp-')) return 'group';
  return 'user';
}


const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif|ico|tiff?|jfif)$/i;
const VIDEO_EXT_RE = /\.(mp4|m4v|webm|ogg|ogv|mov|mkv|avi|3gp|wmv|flv)$/i;

function attachmentName(a) {
  if (!a) return 'file';
  if (a.name) return a.name;
  const path = a.path || a.url || '';
  const name = String(path).split('/').pop();
  return name || 'file';
}

function normalizeAttachment(a) {
  if (typeof a === 'string') return { name: attachmentName(a), path: a };
  if (!a || typeof a !== 'object') return null;
  return { ...a, name: attachmentName(a) };
}

function attachmentMime(a) {
  return String(a?.type || a?.mimeType || a?.mimetype || a?.mime || '').toLowerCase();
}

function isImageAttachment(a) {
  const mime = attachmentMime(a);
  if (mime.startsWith('image/')) return true;
  return IMAGE_EXT_RE.test(attachmentName(a));
}

function isVideoAttachment(a) {
  const mime = attachmentMime(a);
  if (mime.startsWith('video/')) return true;
  if (mime.startsWith('audio/')) return false;
  return VIDEO_EXT_RE.test(attachmentName(a));
}

function attachmentUrl(a) {
  const path = a?.path || a?.url || '';
  if (!path) return '#';
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return (API_BASE || '') + path;
}

// Text used by the message context menu's Copy action. Falls back to the
// attachment file names for attachment-only messages so it never copies ''.
function messageCopyText(m) {
  const content = String(m?.content || '').trim();
  if (content) return content;
  if (Array.isArray(m?.attachments) && m.attachments.length > 0) {
    return m.attachments
      .map((a) => attachmentName(normalizeAttachment(a)))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

async function copyToClipboard(value) {
  const text = String(value ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

export default function CommentManagement() {
  const { user, darkMode } = useAuth();
  const { t } = useTranslation();
  const dark = !!darkMode;
  const T = dark ? { bg:'#0B1220', panel:'#111C2E', surface:'#16243A', bubbleIn:'#1B2A41', border:'#263750', text:'#E6EDF7', text2:'#9AAAC0', muted:'#71829B', accent:'#3B82F6', purple:'#6366F1', btn:'linear-gradient(90deg,#2563EB,#6366F1)', out:'linear-gradient(90deg,#1D4ED8,#4F46E5)', hover:'#1C2B45', input:'#0F1A2B', green:'#22C55E' } : { bg:'#F8FAFF', panel:'#FFFFFF', surface:'#EFF4FF', bubbleIn:'#E9EDFA', border:'#D7E3FF', text:'#102B65', text2:'#38558D', muted:'#6b7280', accent:'#0866F5', purple:'#6366F1', btn:'linear-gradient(90deg,#0875F9,#2563EB)', out:'linear-gradient(90deg,#0875F9,#2563EB)', hover:'#EAF1FF', input:'#FFFFFF', green:'#10B981' };
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewMedia, setPreviewMedia] = useState(null);
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
  const [activity, setActivity] = useState({});  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [acceptType, setAcceptType] = useState('*/*');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const textareaRef = useRef(null);
  const attachRef = useRef(null);
  const emojiRef = useRef(null);
  const contextMenuRef = useRef(null);

  const role = user?.role || 'client';

  useEffect(() => {
    const content = document.querySelector('.content');
    const prev = content ? content.style.overflow : '';
    if (content) content.style.overflow = 'hidden';
    return () => { if (content) content.style.overflow = prev; };
  }, []);

  const fetchDirectory = useCallback(async () => {
    const [u, g] = await Promise.all([
      api.get('/api/users').catch(() => []),
      api.get('/api/groups').catch(() => []),
    ]);
    return {
      users: Array.isArray(u) ? u : (u?.users || []),
      groups: Array.isArray(g) ? g : (g?.groups || []),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDirectory();
        if (cancelled) return;
        setUsers(data.users);
        setGroups(data.groups);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchDirectory]);

  // Keep the directory in sync with users/groups edited elsewhere in the app.
  useEffect(() => {
    let cancelled = false;
    const refreshDirectory = async () => {
      try {
        const data = await fetchDirectory();
        if (cancelled) return;
        setUsers(data.users);
        setGroups(data.groups);
      } catch (e) { /* keep the last known directory */ }
    };
    const onFocus = () => { refreshDirectory(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshDirectory(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchDirectory]);

  const sections = buildSections(role, user, users, groups, t);
  sections.sort((a, b) => {
    const aAct = Math.max(0, ...a.items.map((it) => activity[it.id] || 0));
    const bAct = Math.max(0, ...b.items.map((it) => activity[it.id] || 0));
    return bAct - aAct;
  });
  sections.forEach((s) => {
    s.items.sort((a, b) => (activity[b.id] || 0) - (activity[a.id] || 0));
  });

  const openConversation = useCallback(async (conv) => {
    setSelectedUser(conv);
    setMessages([]);
    setText('');
    setAttachments([]);
    setReplyTo(null);
    setEditingId(null);
    setContextMenu(null);
    setDeleteTarget(null);
    setMsgLoading(true);
    try {
      const data = await api.get(`/api/messages?conversationType=${conv.type}&conversationId=${encodeURIComponent(conv.id)}`);
      setMessages(Array.isArray(data) ? data : []);
      if (Array.isArray(data)) {
        const incoming = data.filter((m) => m.sender_id !== user?.id);
        if (incoming.length) {
          const last = incoming[incoming.length - 1];
          const ts = new Date(last.created_at).getTime() || Date.now();
          setActivity((prev) => {
            const prevTs = prev[conv.id] || 0;
            return { ...prev, [conv.id]: Math.max(ts, prevTs + 1) };
          });
        }
      }
      await api.put('/api/messages/read', { conversationType: conv.type, conversationId: conv.id });
      setUnreadMap((m) => ({ ...m, [conv.type + ':' + conv.id]: 0 }));
      try { window.dispatchEvent(new Event('rhms:unread-changed')); } catch {}
      try { localStorage.setItem('rhms_selected_conv', JSON.stringify({ type: conv.type, id: conv.id })); } catch {}
    } catch (e) {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onClick = (e) => {
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttachMenu(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Keep the message context menu fully inside the viewport after it renders.
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const pad = 8;
    let x = contextMenu.x;
    let y = contextMenu.y;
    if (x + rect.width + pad > window.innerWidth) x = Math.max(pad, window.innerWidth - rect.width - pad);
    if (y + rect.height + pad > window.innerHeight) y = Math.max(pad, window.innerHeight - rect.height - pad);
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu((cur) => (cur ? { ...cur, x, y } : cur));
    }
  }, [contextMenu]);

  // Close the context menu on outside click, Escape, or window resize.
  useEffect(() => {
    if (!contextMenu) return;
    const onOutside = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) return;
      setContextMenu(null);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const onResize = () => setContextMenu(null);
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('touchstart', onOutside, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('touchstart', onOutside, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [contextMenu]);

  // Escape closes the delete confirmation dialog.
  useEffect(() => {
    if (!deleteTarget) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) setDeleteTarget(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, deleting]);

  // Realtime reordering based on incoming messages (SSE)
  useEffect(() => {
    const token = localStorage.getItem('rhms_token');
    if (!token || !user?.id) return;
    let es;
    try {
      es = new EventSource(`${API_BASE}/api/notifications/stream?token=${token}`);
    } catch (e) {
      return;
    }
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || data.type === 'init' || data.message === 'Connected') return;
        const d = data.data || {};
        if (d.type !== 'message') return;
        if (d.userId && String(d.userId) === String(user.id)) return; // skip own
        const ts = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
        const convType = d.conversationType || 'direct';
        const convId = convType === 'group' ? d.conversationId : d.userId;
        if (!convId) return;
        setActivity((prev) => {
          const prevTs = prev[convId] || 0;
          const nextTs = Math.max(ts, prevTs + 1);
          if (nextTs === prevTs) return prev;
          return { ...prev, [convId]: nextTs };
        });
        // refresh unread badge for this conversation
        api.get(`/api/messages/unread-count?conversationType=${convType}&conversationId=${encodeURIComponent(convId)}`)
          .then((r) => {
            setUnreadMap((m) => ({ ...m, [convType + ':' + convId]: r?.count || 0 }));
          })
          .catch(() => {});
      } catch (e) {}
    };
    return () => { try { es.close(); } catch (e) {} };
  }, [user?.id]);

  // Fallback polling: keep reordering working even if SSE is unavailable
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const pollAll = async () => {
      const flat = (sections || []).flatMap((s) => s.items || []);
      for (const it of flat) {
        if (cancelled) return;
        try {
          const data = await api.get(`/api/messages?conversationType=${it.type}&conversationId=${encodeURIComponent(it.id)}`);
          if (!Array.isArray(data)) continue;
          const incoming = data.filter((m) => m.sender_id !== user.id);
          if (!incoming.length) continue;
          const last = incoming[incoming.length - 1];
          const ts = new Date(last.created_at).getTime() || Date.now();
          setActivity((prev) => {
            const prevTs = prev[it.id] || 0;
            if (ts <= prevTs) return prev;
            return { ...prev, [it.id]: Math.max(ts, prevTs + 1) };
          });
        } catch {}
      }
    };
    pollAll();
    const t = setInterval(pollAll, 6000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id, sections.length]);

  useEffect(() => {
    if (!selectedUser) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.get(`/api/messages?conversationType=${selectedUser.type}&conversationId=${encodeURIComponent(selectedUser.id)}`);
        if (Array.isArray(data)) {
          setMessages(data);
          const incoming = data.filter((m) => m.sender_id !== user?.id);
          if (incoming.length) {
            const last = incoming[incoming.length - 1];
            const ts = new Date(last.created_at).getTime() || Date.now();
            setActivity((prev) => {
              const prevTs = prev[selectedUser.id] || 0;
              return { ...prev, [selectedUser.id]: Math.max(ts, prevTs + 1) };
            });
          }
          await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
          setUnreadMap((m) => ({ ...m, [selectedUser.type + ':' + selectedUser.id]: 0 }));
          try { window.dispatchEvent(new Event('rhms:unread-changed')); } catch {}
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
        uploaded.push({ name: files[i].name, path: res.path, size: files[i].size, type: files[i].type || '' });
      } catch (e) { console.error(e); }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    setUploadProgress(0);
    return uploaded;
  };

  const send = async () => {
    const hasText = !!text.trim();
    if ((!hasText && attachments.length === 0) || !selectedUser || sending) return;
    setSending(true);
    try {
      let atts = attachments
        .filter((f) => f && f.path)
        .map((f) => ({ name: f.name, path: f.path, size: f.size, type: f.type || '' }));
      // upload any raw files selected in the composer
      const rawFiles = attachments.filter((f) => !f.path && f instanceof File);
      if (rawFiles.length) {
        const uploaded = await uploadAttachments(rawFiles);
        atts = [...atts, ...uploaded];
      }
      // A comment can be text-only, attachment-only, or text + attachments.
      if (!hasText && atts.length === 0) return;
      const created = await api.post('/api/messages', {
        conversationType: selectedUser.type,
        conversationId: selectedUser.id,
        content: hasText ? text : '',
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

  const openFilePicker = (accept) => {
    setAcceptType(accept);
    setShowAttachMenu(false);
    const input = fileInputRef.current;
    if (!input) return;
    // Apply the filter immediately so the picker always reflects the chosen type.
    input.accept = accept;
    input.value = '';
    input.click();
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

  const openMessageMenu = useCallback((e, message) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const x = e?.clientX ?? 0;
    const y = e?.clientY ?? 0;
    setContextMenu({ msg: message, x, y });
  }, []);

  const handleEdit = async (msgId) => {
    const nextContent = editText.trim();
    if (!nextContent) {
      showStatusToast('Message text cannot be empty', 'error');
      return;
    }
    try {
      const res = await api.put(`/api/messages/${msgId}`, { content: editText });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? res : m)));
      setEditingId(null);
      setEditText('');
      showStatusToast('Message updated');
    } catch (e) {
      showStatusToast(e?.message || 'Could not update the message', 'error');
    }
  };

  const requestDelete = (message) => {
    setContextMenu(null);
    setDeleteTarget(message);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/api/messages/${deleteTarget.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
      showStatusToast('Message deleted');
    } catch (e) {
      showStatusToast(e?.message || 'Could not delete the message', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async (message) => {
    const value = messageCopyText(message);
    if (!value) {
      showStatusToast('This message has no text to copy', 'error');
      return;
    }
    const ok = await copyToClipboard(value);
    showStatusToast(ok ? 'Message copied to clipboard' : 'Could not copy the message', ok ? 'success' : 'error');
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

  const directorySections = filteredSections
    .map((s) => ({
      ...s,
      visibleItems: s.items.filter((it) => filter !== 'unread' || (unreadMap[it.type + ':' + it.id] || 0) > 0),
    }))
    .filter((s) => filter !== 'unread' || s.visibleItems.length > 0);

  const toggleGroup = useCallback((key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (loading) return <div className="page-container"><div className="loading-screen"><div className="spinner"></div></div></div>;
  if (error) return <div className="page-container"><div className="empty-state">{error}</div></div>;

  return (
    <div className="page-container cm-root" style={{ padding: 0, height: 'calc(100vh - 88px)', overflow: 'hidden', '--cm-hover': T.hover }}>
      <style>{`
        .cm-root button { transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease; }
        .cm-root button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .cm-root button:active { transform: translateY(0); }
        .cm-root [data-conv]:hover { background: var(--cm-hover) !important; }
        .cm-root { height: 100vh; max-height: 100vh; overflow: hidden; }
        .cm-root .cm-shell { overflow: hidden; min-height: 0; }
        .cm-root .cm-left, .cm-root .cm-right { min-height: 0; overflow: hidden; }
        .cm-root .cm-messages { overflow-y: auto; overflow-x: hidden; min-height: 0; }

        .cm-root .cm-directory { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.45) transparent; }
        .cm-root .cm-directory::-webkit-scrollbar { width: 6px; }
        .cm-root .cm-directory::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.38); border-radius: 999px; }
        .cm-root .cm-role-header { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 10px; border-radius: 14px; border: 1px solid transparent; cursor: pointer; text-align: left; font-family: inherit; transition: box-shadow 0.18s ease, filter 0.18s ease; }
        .cm-root .cm-role-header:hover { transform: none !important; box-shadow: 0 3px 10px rgba(15,23,42,0.07) !important; filter: saturate(1.04); }
        .cm-root .cm-role-header:active { transform: none !important; box-shadow: none !important; }
        .cm-root .cm-role-icon { width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55); }
        .cm-root .cm-role-count { min-width: 26px; height: 26px; padding: 0 7px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; flex-shrink: 0; }
        .cm-root .cm-role-chevron { flex-shrink: 0; transition: transform 0.2s ease; }
        .cm-root .cm-role-chevron.collapsed { transform: rotate(-90deg); }
        .cm-root .cm-group-body { padding: 4px 2px 8px; }
        .cm-root .cm-user-row { display: flex; align-items: center; gap: 10px; padding: 8px 9px; margin: 2px 0; border-radius: 11px; border: 1px solid transparent; border-left: 3px solid transparent; cursor: pointer; transition: background 0.16s ease, border-color 0.16s ease; }
        .cm-root .cm-user-row:hover { background: var(--cm-row-hover) !important; border-color: var(--cm-row-selected-border); }
        .cm-root .cm-user-row.is-selected { background: var(--cm-row-selected) !important; border-left-color: var(--cm-row-accent) !important; border-color: var(--cm-row-selected-border); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.4); }
        .cm-root .cm-user-row.is-selected:hover { background: var(--cm-row-selected) !important; }
        .cm-root .cm-unread-pill { min-width: 19px; height: 19px; padding: 0 6px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; line-height: 1; flex-shrink: 0; }

        @media (max-width: 900px) {
          .cm-root .cm-shell { flex-direction: column !important; }
          .cm-root .cm-left { width: 100% !important; max-height: 42%; }
          .cm-root .cm-right { flex: 1 1 auto !important; min-height: 0; }
        }
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
      <div className="cm-shell" style={{ display: 'flex', gap: 12, padding: 12, height: 'calc(100vh - 180px)', background: T.bg, overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel */}
        <div className="cm-left" style={{ display: 'flex', flexDirection: 'column', background: T.panel, borderRadius: 16, border: '1px solid ' + T.border, overflow: 'hidden', width: 320, flexShrink: 0, minHeight: 0 }}>
          <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid ' + T.border, background: dark ? 'linear-gradient(180deg, rgba(37,99,235,0.10), rgba(17,28,46,0))' : 'linear-gradient(180deg, #FBFDFF 0%, #F5F9FF 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.25, color: T.text, fontWeight: 700 }}>Conversations</h2>
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Browse your team by role</div>
              </div>
              <button className="cm-new-btn" title="New conversation" style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: T.btn, color: '#fff', cursor: 'pointer', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['all', 'unread', 'mentions'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid ' + (filter === f ? T.accent : T.border), background: filter === f ? T.accent : (dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'), color: filter === f ? '#FFFFFF' : T.text2, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, textTransform: 'capitalize' }}>
                  {f}{f === 'all' ? ` (${flatItems.length})` : f === 'unread' ? ` (${totalUnread})` : ''}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: dark ? T.input : '#FFFFFF', borderRadius: 10, padding: '7px 10px', border: '1px solid ' + T.border, transition: 'border-color 0.2s, box-shadow 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = '0 0 0 3px ' + (dark ? 'rgba(59,130,246,0.15)' : 'rgba(8,102,245,0.12)'); }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}>
              <Icon name="search" size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('messages.searchConversations')} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent', color: T.text }} />
            </div>
          </div>
          <div className="cm-directory" style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 12px' }}>
            {directorySections.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '36px 16px', textAlign: 'center', color: T.muted }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: dark ? 'rgba(148,163,184,0.12)' : '#F1F5FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UsersRound size={20} color={T.muted} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t('messages.noConversations')}</div>
              </div>
            )}
            {directorySections.map((section) => {
              const themeKey = sectionThemeKey(section);
              const palette = ROLE_THEMES[themeKey];
              const theme = palette[dark ? 'dark' : 'light'];
              const ThemeIcon = palette.Icon;
              const isCollapsed = !search.trim() && !!collapsedGroups[section.key];
              const visibleItems = section.visibleItems;
              const totalItems = themeKey === 'group' ? (section.count || section.items.length) : section.items.length;
              return (
                <div key={section.key} style={{ marginBottom: 6 }}>
                  <button
                    type="button"
                    className="cm-role-header"
                    aria-expanded={!isCollapsed}
                    aria-label={`${section.title} group`}
                    onClick={() => toggleGroup(section.key)}
                    style={{ background: theme.gradient, borderColor: theme.border, color: T.text }}
                  >
                    <span className="cm-role-icon" style={{ background: theme.iconBg }}>
                      <ThemeIcon size={17} strokeWidth={2.1} color={theme.accent} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: 0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{section.title}</span>
                      <span style={{ display: 'block', fontSize: 10.5, color: dark ? T.text2 : '#5B6B85', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{section.key === 'admin-support' ? 'Administrators ready to assist' : palette.description}</span>
                    </span>
                    <span className="cm-role-count" style={{ background: theme.countBg, color: theme.accent, boxShadow: 'inset 0 0 0 1px ' + (dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)') }}>{totalItems}</span>
                    <ChevronDown size={15} color={theme.accent} className={'cm-role-chevron' + (isCollapsed ? ' collapsed' : '')} />
                  </button>
                  {!isCollapsed && (
                    <div className="cm-group-body">
                      {visibleItems.length === 0 && <div style={{ padding: '9px 10px', fontSize: 11.5, color: T.muted }}>No members to show</div>}
                      {visibleItems.map((it) => {
                        const key = it.type + ':' + it.id;
                        const isActive = selectedUser && selectedUser.type === it.type && selectedUser.id === it.id;
                        const unread = unreadMap[key] || 0;
                        const isGroup = it.type === 'group';
                        const roleLabel = isGroup ? 'Group chat' : (t('role.' + (it.role === 'support' ? 'escalationTeam' : it.role)) || it.role);
                        const online = isGroup ? true : !!it.online;
                        const statusLabel = isGroup ? `${it.members?.length || 0} members` : (online ? t('common.online') : t('common.offline'));
                        return (
                          <div
                            key={key}
                            data-conv
                            className={'cm-user-row' + (isActive ? ' is-selected' : '')}
                            onClick={() => openConversation(it)}
                            style={{
                              '--cm-row-hover': theme.rowHover,
                              '--cm-row-selected': theme.rowSelected,
                              '--cm-row-accent': theme.accent,
                              '--cm-row-selected-border': theme.rowSelectedBorder,
                            }}
                          >
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <Avatar user={{ name: it.name, avatar: it.avatar }} size={38} />
                              <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: online ? '#10B981' : (dark ? '#64748B' : '#CBD5E1'), border: '2px solid ' + (isActive ? theme.rowSelected : T.panel), boxSizing: 'content-box' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 650, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                                {it.time ? <span style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>{it.time}</span> : null}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, minWidth: 0 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? '#10B981' : (dark ? '#64748B' : '#94A3B8'), flexShrink: 0 }} />
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: theme.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleLabel}</span>
                                <span style={{ fontSize: 10.5, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {statusLabel}</span>
                                {unread > 0 && <span className="cm-unread-pill" style={{ marginLeft: 'auto', background: theme.accent, color: dark ? '#0B1220' : '#FFFFFF' }}>{unread}</span>}
                              </div>
                              {it.last ? <div style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{it.last}</div> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="cm-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.panel, borderRadius: 16, border: '1px solid ' + T.border, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          {selectedUser ? (
            <>
              <div style={{ padding: 14, borderBottom: '1px solid ' + T.border, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar user={{ name: selectedUser.name, avatar: selectedUser.avatar }} size={44} />
                  <div>
                    <div style={{ fontWeight: 700, color: T.text }}>{selectedUser.name}</div>
                    <div style={{ fontSize: 12, color: T.text2 }}>{t('role.' + (selectedUser.role === 'support' ? 'escalationTeam' : selectedUser.role)) || selectedUser.role} · {selectedUser.online ? t('common.online') : t('common.offline')}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>ID: {selectedUser.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ padding: 8, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="Call">📞</button>
                  <button style={{ padding: 8, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="More">⋯</button>
                </div>
              </div>
              <div ref={messagesContainerRef} className="cm-messages" style={{ flex: 1, overflowY: 'auto', padding: 16, background: T.bg }}>
                {msgLoading && <div style={{ textAlign: 'center', color: T.muted }}>Loading...</div>}
                {!msgLoading && messages.length === 0 && <div style={{ textAlign: 'center', color: T.muted }}>{t('messages.noMessagesYet')}</div>}
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
                            <div style={{ position: 'relative', background: own ? (dark ? '#DBEAFE22' : '#EAF2FF') : (dark ? '#F1F5F922' : '#F3F4F6'), color: own ? (dark ? '#E2E8F0' : '#1E3A8A') : (dark ? '#E2E8F0' : '#1F2937'), padding: '10px 14px', borderRadius: 18, border: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : (dark ? '1px solid #475569' : '1px solid #E5E7EB'), boxShadow: own ? '0 4px 12px rgba(37,99,235,0.14)' : '0 4px 12px rgba(0,0,0,0.08)', backdropFilter: 'blur(2px)' }} onContextMenu={(e) => openMessageMenu(e, m)}>
                              {/* tail */}
                              <span style={{ position: 'absolute', bottom: -7, [own ? 'right' : 'left']: 16, width: 14, height: 14, background: 'inherit', transform: 'rotate(45deg)', borderRadius: 3, borderRight: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : 'none', borderBottom: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : 'none', borderLeft: !own ? (dark ? '1px solid #475569' : '1px solid #E5E7EB') : 'none', borderTop: !own ? (dark ? '1px solid #475569' : '1px solid #E5E7EB') : 'none', zIndex: 0, boxShadow: own ? '2px 2px 6px rgba(37,99,235,0.08)' : '2px 2px 6px rgba(0,0,0,0.05)' }} />
                              <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11, opacity: 0.9, flexWrap: 'wrap', textAlign: own ? 'right' : 'left', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                                  <span style={{ fontWeight: 700, color: own ? (dark ? '#BFDBFE' : '#1D4ED8') : (dark ? '#E2E8F0' : '#111827') }}>{own ? (m.sender_name || 'You') : (m.sender_name || 'Unknown')}</span>
                                  <span style={{ color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280'), fontWeight: 500 }}>{t('role.' + (m.sender_role === 'support' ? 'escalationTeam' : m.sender_role)) || m.sender_role}</span>
                                  <span style={{ color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280') }}>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                  {m.edited_at && <span style={{ fontStyle: 'italic', color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280') }}>(edited)</span>}
                                </div>
                                {m.content ? <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</div> : null}
                                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: own ? 'flex-end' : 'flex-start' }}>
                                    {(() => {
                                      const all = m.attachments.map(normalizeAttachment).filter(Boolean);
                                      const media = all.filter((a) => isImageAttachment(a) || isVideoAttachment(a));
                                      const docs = all.filter((a) => !isImageAttachment(a) && !isVideoAttachment(a));
                                      return (
                                        <>
                                          {media.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: media.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 4, maxWidth: 300, borderRadius: 8, overflow: 'hidden' }}>
                                              {media.map((a, i) => {
                                                const url = attachmentUrl(a);
                                                const name = attachmentName(a);
                                                if (isImageAttachment(a)) {
                                                  return (
                                                    <img key={i} src={url} alt={name} onClick={() => setPreviewMedia({ type: 'image', url })} style={{ width: '100%', height: media.length > 1 ? 120 : 'auto', maxHeight: 260, objectFit: 'cover', cursor: 'pointer', display: 'block', borderRadius: 6 }} />
                                                  );
                                                }
                                                return (
                                                  <div key={i} onClick={() => setPreviewMedia({ type: 'video', url })} style={{ position: 'relative', width: '100%', height: media.length > 1 ? 120 : 180, background: '#000', cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}>
                                                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted preload="metadata" playsInline />
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {docs.map((a, i) => {
                                            const url = attachmentUrl(a);
                                            const name = attachmentName(a);
                                            const sizeLabel = a.size ? (a.size > 1024 * 1024 ? (a.size / (1024 * 1024)).toFixed(1) + ' MB' : Math.round(a.size / 1024) + ' KB') : '';
                                            const ext = (name.split('.').pop() || '').toUpperCase();
                                            const icon = /\.pdf$/i.test(name) ? 'PDF' : /\.(docx?)$/i.test(name) ? 'DOC' : /\.(xlsx?|csv)$/i.test(name) ? 'XLS' : /\.(pptx?)$/i.test(name) ? 'PPT' : /\.(mp3|wav|ogg|m4a|aac|flac|oga)$/i.test(name) ? 'AUD' : 'FILE';
                                            return (
                                              <a key={i} href={url} target="_blank" rel="noreferrer" download style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: '1px solid ' + T.border, textDecoration: 'none', color: own ? (dark ? '#BFDBFE' : '#1D4ED8') : T.accent, maxWidth: 300 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 8, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{icon}</div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                                  <div style={{ fontSize: 10, color: T.muted }}>{ext}{sizeLabel ? ' · ' + sizeLabel : ''}</div>
                                                </div>
                                                <div style={{ fontSize: 12, flexShrink: 0 }}>⬇</div>
                                              </a>
                                            );
                                          })}
                                        </>
                                      );
                                    })()}
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
                           <button key={opt.label} onClick={() => openFilePicker(opt.accept)}
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
                                 <input value={emojiSearch} onChange={(e) => setEmojiSearch(e.target.value)} placeholder={t('messages.searchEmoji')} style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, background: 'transparent', color: T.text }} />
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
                  <button onClick={send} disabled={sending || (!text.trim() && attachments.length === 0)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: T.accent, color: '#fff', cursor: 'pointer', opacity: (sending || (!text.trim() && attachments.length === 0)) ? 0.5 : 1 }}>{t('messages.send')}</button>
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
      {previewMedia && (
        <div onClick={() => setPreviewMedia(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          {previewMedia.type === 'image' ? (
            <img src={previewMedia.url} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} />
          ) : (
            <video src={previewMedia.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10 }} />
          )}
          <a href={previewMedia.url} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 24, right: 24, padding: '8px 14px', borderRadius: 8, background: '#fff', color: '#111', textDecoration: 'none', fontWeight: 600 }}>Download</a>
        </div>
      )}
      {contextMenu && createPortal(
        (() => {
          const msg = contextMenu.msg;
          const own = msg?.sender_id === user?.id;
          const canModify = own || role === 'admin';
          const copyValue = messageCopyText(msg);
          const actions = [
            { key: 'copy', label: 'Copy', icon: <Copy size={16} />, disabled: !copyValue, onClick: () => { setContextMenu(null); handleCopy(msg); } },
            { key: 'reply', label: 'Reply', icon: <Reply size={16} />, onClick: () => { setReplyTo(msg); setContextMenu(null); } },
            { key: 'react', label: 'React 👍', icon: <Smile size={16} />, onClick: () => { handleReaction(msg.id, '👍'); setContextMenu(null); } },
            ...(canModify ? [
              { key: 'divider', divider: true },
              { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, onClick: () => { setEditingId(msg.id); setEditText(msg.content || ''); setContextMenu(null); } },
              { key: 'delete', label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: () => requestDelete(msg) },
            ] : []),
          ];
          return (
            <div
              ref={contextMenuRef}
              role="menu"
              aria-label="Message actions"
              onContextMenu={(e) => e.preventDefault()}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 4000, minWidth: 200, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', background: T.panel, border: '1px solid ' + T.border, borderRadius: 12, boxShadow: dark ? '0 18px 44px rgba(0,0,0,0.55)' : '0 18px 44px rgba(15,23,42,0.18)', padding: 6, userSelect: 'none' }}
            >
              <div style={{ padding: '4px 10px 6px', fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: T.muted }}>Message actions</div>
              {actions.map((a) => a.divider ? (
                <div key={a.key} style={{ height: 1, background: T.border, margin: '4px 6px' }} />
              ) : (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  disabled={a.disabled}
                  onClick={a.onClick}
                  onMouseEnter={(e) => { if (a.disabled) return; e.currentTarget.style.background = a.danger ? (dark ? 'rgba(239,68,68,0.14)' : '#FEF2F2') : T.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: a.disabled ? 'not-allowed' : 'pointer', color: a.danger ? '#EF4444' : T.text, fontSize: 13, fontWeight: 500, textAlign: 'left', opacity: a.disabled ? 0.45 : 1, transition: 'background 0.12s ease' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, color: a.danger ? '#EF4444' : (dark ? '#93C5FD' : '#2563EB') }}>{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          );
        })(),
        document.body
      )}
      {deleteTarget && createPortal(
        <div
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
          style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4001, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-delete-title"
            style={{ width: '100%', maxWidth: 380, background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, padding: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: dark ? 'rgba(239,68,68,0.16)' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={18} color="#EF4444" />
              </div>
              <div id="cm-delete-title" style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Delete message?</div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: T.text2, marginBottom: 18, wordBreak: 'break-word' }}>
              {String(deleteTarget.content || '').trim()
                ? `“${String(deleteTarget.content).trim().slice(0, 140)}${String(deleteTarget.content).trim().length > 140 ? '…' : ''}” will be permanently removed. `
                : 'This attachment message will be permanently removed. '}
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: deleting ? 0.7 : 1 }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>

  );
}

function buildSections(role, me, users, groups, t) {
  const byRole = (r) => users.filter((u) => u.role === r && u.id !== me?.id);
  const sections = [];
  if (role === 'admin') {
    sections.push({ key: 'adm', title: t('role.administrators'), count: byRole('admin').length, items: byRole('admin').map(toItem('direct')) });
    sections.push({ key: 'dev', title: t('role.developers'), count: byRole('developer').length, items: byRole('developer').map(toItem('direct')) });
    sections.push({ key: 'esc', title: t('role.escalationTeam'), count: byRole('support').length, items: byRole('support').map(toItem('direct')) });
    sections.push({ key: 'cli', title: t('role.client') + 's', count: byRole('client').length, items: byRole('client').map(toItem('direct')) });
    sections.push({ key: 'usr', title: t('common.users') || 'Users', count: users.filter((u) => !['admin','developer','support','client'].includes(u.role) && u.id !== me?.id).length, items: users.filter((u) => !['admin','developer','support','client'].includes(u.role) && u.id !== me?.id).map(toItem('direct')) });
  } else if (role === 'client') {
    const admins = byRole('admin');
    sections.push({ key: 'adm', title: t('role.administrators'), count: admins.length, items: admins.map(toItem('direct')) });
  } else if (role === 'developer') {
    const adminItems = byRole('admin').map(toItem('direct')).map((it) => ({ ...it, specialAdmin: true }));
    const sameGroupDevs = users.filter((u) => u.role === 'developer' && u.id !== me?.id && sharesGroup(u, me, groups));
    const esc = byRole('support');
    const myGroups = groups.filter((g) => isMember(g, me?.id));
    const groupSections = myGroups.map((g) => ({ key: 'grp-' + g.id, title: g.name, count: (g.members || []).length, items: [{ id: g.id, type: 'group', name: g.name, role: 'Group Chat', members: (g.members || []).map((mid) => users.find((u) => u.id === mid)).filter(Boolean), avatar: null, last: '', time: '', online: true, specialAdmin: false }] }));
    if (adminItems.length) sections.push({ key: 'admin-support', title: 'Admin Support', special: true, count: adminItems.length, items: adminItems });
    groupSections.forEach((s) => sections.push(s));
    if (sameGroupDevs.length) sections.push({ key: 'dev', title: t('role.developers'), count: sameGroupDevs.length, items: sameGroupDevs.map(toItem('direct')) });
    if (esc.length) sections.push({ key: 'esc', title: t('role.escalationTeam'), count: esc.length, items: esc.map(toItem('direct')) });
  } else if (role === 'support') {
    const adminItems = byRole('admin').map(toItem('direct')).map((it) => ({ ...it, specialAdmin: true }));
    const esc = byRole('support').filter((u) => u.id !== me?.id);
    const devs = byRole('developer');
    if (adminItems.length) sections.push({ key: 'admin-support', title: 'Admin Support', special: true, count: adminItems.length, items: adminItems });
    if (esc.length) sections.push({ key: 'esc', title: t('role.escalationTeam'), count: esc.length, items: esc.map(toItem('direct')) });
    if (devs.length) sections.push({ key: 'dev', title: t('role.developers'), count: devs.length, items: devs.map(toItem('direct')) });
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
      specialAdmin: !!it.specialAdmin || !!s.special,
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



