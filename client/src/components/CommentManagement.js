import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircleMore, Image as ImageIcon, Video, FileText, Music, Paperclip, Smile, Search, ShieldCheck, Copy, Pencil, Trash2, Reply, Code2, Headset, UsersRound, ChevronDown, ChevronRight, Mic, Play, Pause, Square, X, Pin, PinOff, FolderOpen, Link2, Forward, Flag, CheckSquare, Save, MoreVertical, Bell, BellOff, RefreshCw, Info, CheckCheck } from 'lucide-react';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { showStatusToast } from '../notify';
import Icon from './Icon';
import OpenWithDialog from './OpenWithDialog';
import { cleanDocumentName, documentKind } from '../utils/documents';

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
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|wma|webm|weba)$/i;

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

function isAudioAttachment(a) {
  const mime = attachmentMime(a);
  if (mime.startsWith('audio/')) return true;
  if (mime.startsWith('video/')) return false;
  return AUDIO_EXT_RE.test(attachmentName(a));
}

function isVideoAttachment(a) {
  const mime = attachmentMime(a);
  if (mime.startsWith('video/')) return true;
  if (mime.startsWith('audio/')) return false;
  if (AUDIO_EXT_RE.test(attachmentName(a))) return false;
  return VIDEO_EXT_RE.test(attachmentName(a));
}

function attachmentUrl(a) {
  const path = a?.path || a?.url || '';
  if (!path) return '#';
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return (API_BASE || '') + path;
}

async function saveBlob(blob, name) {
  const safeName = name || 'attachment';
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const ext = (safeName.includes('.') ? '.' + safeName.split('.').pop() : '').toLowerCase();
      const pickerOpts = { suggestedName: safeName };
      if (ext) pickerOpts.types = [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: [ext] } }];
      const handle = await window.showSaveFilePicker(pickerOpts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (err) {} }, 10000);
}

function saveBlobUrl(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name || 'attachment';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadAttachment({ url, path, name, messageId }) {
  const safeName = cleanDocumentName(name || path || url);
  if (!path || /^(blob:|data:)/i.test(path)) {
    saveBlobUrl(url, safeName);
    return;
  }
  const params = new URLSearchParams({ path, name: safeName });
  if (messageId) params.set('messageId', messageId);
  const token = localStorage.getItem('rhms_token');
  const response = await fetch(`${API_BASE}/api/attachments/download?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = 'Could not download the attachment';
    try {
      const data = await response.json();
      if (data && data.error) message = data.error;
    } catch (e) { /* keep fallback message */ }
    throw new Error(message);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  saveBlobUrl(objectUrl, safeName);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

// Short label used in the left-hand conversation preview when the latest
// message contains only attachments (no text body).
function previewAttachmentLabel(atts) {
  if (!Array.isArray(atts) || atts.length === 0) return '';
  const list = atts.map(normalizeAttachment).filter(Boolean);
  if (!list.length) return 'Attachment';
  const first = list[0];
  let label = 'Attachment';
  if (isImageAttachment(first)) label = 'Photo';
  else if (isVideoAttachment(first)) label = 'Video';
  else if (isAudioAttachment(first)) label = 'Voice message';
  else if (attachmentName(first)) label = attachmentName(first);
  return list.length > 1 ? `${label} (+${list.length - 1})` : label;
}

function buildPreviewText(lastMessage, currentUserId) {
  if (!lastMessage) return '';
  const content = String(lastMessage.content || '').trim();
  const atts = Array.isArray(lastMessage.attachments) ? lastMessage.attachments : [];
  let body = content || previewAttachmentLabel(atts);
  if (!body) return '';
  const own = lastMessage.senderId != null && String(lastMessage.senderId) === String(currentUserId);
  return own ? `You: ${body}` : body;
}

function previewTimeLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Compact inline audio player used for both recorded previews and received
// voice messages. Supports play/pause, seeking and duration display.
function AudioPlayer({ src, duration, dark, T, maxWidth = 300 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(Number(duration) || 0);
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => { setTotal(Number(duration) || 0); }, [duration]);
  useEffect(() => () => {
    const el = audioRef.current;
    if (el) { try { el.pause(); } catch (e) {} }
  }, []);

  // Audio endpoints require authentication, but <audio> cannot send an
  // Authorization header. Fetch the protected audio with the normal bearer
  // token, then play it from a short-lived object URL.
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setPlaying(false);
    setCurrent(0);
    setLoadError('');
    if (!src) { setResolvedSrc(''); return () => {}; }
    if (!/^\/api\//.test(src)) { setResolvedSrc(src); return () => {}; }
    setResolvedSrc('');
    const token = localStorage.getItem('rhms_token');
    const controller = new AbortController();
    fetch(`${API_BASE || ''}${src}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then((res) => {
        if (res.status === 401) throw new Error('Session expired. Please sign in again.');
        if (res.status === 403) throw new Error('You do not have access to this voice message.');
        if (!res.ok) throw new Error('Unable to load voice message.');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      })
      .catch((err) => {
        if (!cancelled && err?.name !== 'AbortError') setLoadError(err?.message || 'Unable to load voice message.');
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (e) {} }
    };
  }, [src]);

  if (loadError) {
    return (
      <div style={{ width: '100%', maxWidth, padding: '7px 9px', borderRadius: 12, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: '1px solid ' + T.border }}>
        <div style={{ fontSize: 11, color: '#DC2626' }}>{loadError}</div>
      </div>
    );
  }

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !resolvedSrc) return;
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * total;
    setCurrent(ratio * total);
  };

  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', maxWidth, padding: '7px 9px', borderRadius: 12, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: '1px solid ' + T.border }}>
      <button type="button" onClick={toggle} disabled={!resolvedSrc} title={!resolvedSrc ? 'Loading voice message…' : (playing ? 'Pause' : 'Play')} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: resolvedSrc ? 'pointer' : 'default', opacity: resolvedSrc ? 1 : 0.55, flexShrink: 0, padding: 0 }}>
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 1 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={seek} style={{ height: 4, borderRadius: 999, background: dark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.12)', cursor: 'pointer', overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: T.accent, borderRadius: 999, transition: playing ? 'width 0.2s linear' : 'none' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.muted, marginTop: 3 }}>
          <span>{formatClock(current)}</span>
          <span>{formatClock(total)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={resolvedSrc || undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotal(d);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        style={{ display: 'none' }}
      />
    </div>
  );
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
  const [conversationPeers, setConversationPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [, setUploadProgress] = useState(0);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState('stickers');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachCloseTimerRef = useRef(null);
  const emojiCloseTimerRef = useRef(null);
  const openAttachMenu = () => { if (attachCloseTimerRef.current) { clearTimeout(attachCloseTimerRef.current); attachCloseTimerRef.current = null; } setShowAttachMenu(true); };
  const scheduleCloseAttachMenu = () => { if (attachCloseTimerRef.current) clearTimeout(attachCloseTimerRef.current); attachCloseTimerRef.current = setTimeout(() => { setShowAttachMenu(false); attachCloseTimerRef.current = null; }, 180); };
  const openEmojiPicker = () => { if (emojiCloseTimerRef.current) { clearTimeout(emojiCloseTimerRef.current); emojiCloseTimerRef.current = null; } setShowEmojiPicker(true); };
  const scheduleCloseEmojiPicker = () => { if (emojiCloseTimerRef.current) clearTimeout(emojiCloseTimerRef.current); emojiCloseTimerRef.current = setTimeout(() => { setShowEmojiPicker(false); emojiCloseTimerRef.current = null; }, 180); };
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState([]);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [unreadMap, setUnreadMap] = useState({});
  const [previews, setPreviews] = useState({});
  const [activity, setActivity] = useState({});  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [attachmentMenu, setAttachmentMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [pinnedByConv, setPinnedByConv] = useState({});
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwarding, setForwarding] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [highlightMsgId, setHighlightMsgId] = useState(null);
  const [acceptType, setAcceptType] = useState('*/*');
  const [openDoc, setOpenDoc] = useState(null);
  const [pinnedConversations, setPinnedConversations] = useState([]);
  const [mutedConversations, setMutedConversations] = useState([]);
  const [contactInfo, setContactInfo] = useState(null);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearch, setMsgSearch] = useState('');
  const [msgSearchIndex, setMsgSearchIndex] = useState(0);
  const msgSearchRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const textareaRef = useRef(null);
  const attachRef = useRef(null);
  const emojiRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const selectedConvRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartRef = useRef(0);
  const recCancelRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const waveformTimerRef = useRef(null);
  const voiceStartRef = useRef(false);

  const role = user?.role || 'client';

  const cleanupRecorder = useCallback(() => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    if (waveformTimerRef.current) { clearInterval(waveformTimerRef.current); waveformTimerRef.current = null; }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch (e) {} audioContextRef.current = null; }
    analyserRef.current = null;
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach((track) => track.stop()); } catch (e) {}
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  // Stop the microphone and release resources if the section unmounts.
  useEffect(() => () => {
    const rec = mediaRecorderRef.current;
    recCancelRef.current = true;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) {} }
    cleanupRecorder();
  }, [cleanupRecorder]);

  // Release the recorded audio object URL when it is replaced or discarded.
  useEffect(() => () => {
    if (recordedAudio?.url) { try { URL.revokeObjectURL(recordedAudio.url); } catch (e) {} }
  }, [recordedAudio]);

  // Track the open conversation so real-time events can auto-read it without
  // re-subscribing the SSE connection on every selection change.
  useEffect(() => {
    selectedConvRef.current = selectedUser ? selectedUser.type + ':' + selectedUser.id : null;
  }, [selectedUser]);

  useEffect(() => {
    const content = document.querySelector('.content');
    const prev = content ? content.style.overflow : '';
    if (content) content.style.overflow = 'hidden';
    return () => { if (content) content.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!attachmentMenu) return undefined;
    const onOutside = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-conv-menu-toggle="true"]')) return;
      if (attachmentMenuRef.current && attachmentMenuRef.current.contains(e.target)) return;
      setAttachmentMenu(null);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setAttachmentMenu(null);
    };
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('touchstart', onOutside, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('touchstart', onOutside, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onOutside);
    };
  }, [attachmentMenu]);

  useLayoutEffect(() => {
    if (!attachmentMenu || !attachmentMenuRef.current) return;
    const rect = attachmentMenuRef.current.getBoundingClientRect();
    const pad = 8;
    let x = attachmentMenu.x;
    let y = attachmentMenu.y;
    if (x + rect.width + pad > window.innerWidth) x = Math.max(pad, window.innerWidth - rect.width - pad);
    if (y + rect.height + pad > window.innerHeight) y = Math.max(pad, window.innerHeight - rect.height - pad);
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    if (x !== attachmentMenu.x || y !== attachmentMenu.y) {
      setAttachmentMenu({ ...attachmentMenu, x, y });
    }
  }, [attachmentMenu]);

  const openDocumentChooser = (a, messageId) => {
    const name = attachmentName(a);
    const attachmentPath = a?.path || a?.url || '';
    if (!documentKind(name) || !attachmentPath) return;
    setOpenDoc({ name, path: attachmentPath, messageId });
  };

  const openAttachmentMenu = (e, a, name, messageId, message) => {
    e.preventDefault();
    e.stopPropagation();
    const attachmentPath = a?.path || a?.url || '';
    if (!attachmentPath) return;
    const estW = 240;
    const estH = 420;
    const pad = 8;
    setAttachmentMenu({
      type: 'attachment',
      x: Math.max(pad, Math.min(e.clientX, window.innerWidth - estW - pad)),
      y: Math.max(pad, Math.min(e.clientY, window.innerHeight - estH - pad)),
      url: attachmentUrl(a),
      path: attachmentPath,
      name: cleanDocumentName(name || attachmentPath),
      messageId,
      message: message || null,
    });
  };

  const openMessageMenu = (e, message) => {
    if (!message) return;
    const t = e.target;
    if (t && t.closest && t.closest('button, a, input, textarea, select, [contenteditable="true"], audio, video, [data-attachment-item="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    const estW = 240;
    const estH = 360;
    const pad = 8;
    setAttachmentMenu({
      type: 'message',
      x: Math.max(pad, Math.min(e.clientX, window.innerWidth - estW - pad)),
      y: Math.max(pad, Math.min(e.clientY, window.innerHeight - estH - pad)),
      name: '',
      path: '',
      url: '',
      messageId: message.id,
      message,
    });
  };

  const handleCopyMessageText = async (msg) => {
    const text = messageCopyText(msg);
    if (!text) { showStatusToast('No message text to copy', 'error'); return; }
    const ok = await copyToClipboard(text);
    showStatusToast(ok ? 'Message text copied to clipboard' : 'Could not copy message text', ok ? 'success' : 'error');
  };

  const openConversationMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedUser) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const estW = 248;
    const pad = 8;
    setAttachmentMenu({
      type: 'conversation',
      x: Math.max(pad, Math.min(rect.right - estW, window.innerWidth - estW - pad)),
      y: rect.bottom + 6,
      name: '',
      path: '',
      url: '',
      messageId: null,
      message: null,
    });
  };

  const handleDownloadAttachment = async (attachment) => {
    if (!attachment) return;
    try {
      const started = await downloadAttachment(attachment);
      if (started) showStatusToast('Download started');
    } catch (e) {
      showStatusToast(e?.message || 'Could not download the attachment.', 'error');
    }
  };

  const handleCopyFilename = async (name) => {
    const value = cleanDocumentName(name || '');
    if (!value) { showStatusToast('No filename to copy', 'error'); return; }
    const ok = await copyToClipboard(value);
    showStatusToast(ok ? 'Filename copied to clipboard' : 'Could not copy filename', ok ? 'success' : 'error');
  };

  const buildMessageLink = (msg) => {
    if (!msg || !selectedUser) return window.location.href;
    const url = new URL(window.location.href);
    url.searchParams.set('conversationType', selectedUser.type);
    url.searchParams.set('conversationId', String(selectedUser.id));
    url.searchParams.set('messageId', String(msg.id));
    return url.toString();
  };

  const handleCopyMessageLink = async (msg) => {
    const ok = await copyToClipboard(buildMessageLink(msg));
    showStatusToast(ok ? 'Message link copied to clipboard' : 'Could not copy message link', ok ? 'success' : 'error');
  };

  const isSelected = (msgId) => selectedMessages.includes(msgId);
  const toggleSelectMessage = (msg) => {
    if (!msg?.id) return;
    setSelectedMessages((prev) => prev.includes(msg.id) ? prev.filter((id) => id !== msg.id) : [...prev, msg.id]);
  };

  const convKey = (conv) => (conv ? `${conv.type}:${conv.id}` : '');
  const currentConvKey = convKey(selectedUser);
  const isPinned = (msgId) => !!(currentConvKey && msgId && (pinnedByConv[currentConvKey] || []).includes(msgId));
  const togglePinMessage = (msg) => {
    if (!msg?.id || !currentConvKey) return;
    setPinnedByConv((prev) => {
      const list = prev[currentConvKey] || [];
      const nextList = list.includes(msg.id) ? list.filter((id) => id !== msg.id) : [...list, msg.id];
      const next = { ...prev, [currentConvKey]: nextList };
      try { localStorage.setItem('rhms_pinned_messages', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const isConvPinned = (conv) => !!conv && pinnedConversations.includes(convKey(conv));
  const isConvMuted = (conv) => !!conv && mutedConversations.includes(convKey(conv));

  const togglePinnedConversation = (conv) => {
    if (!conv) return;
    const key = convKey(conv);
    setPinnedConversations((prev) => {
      const pinned = prev.includes(key);
      const next = pinned ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem('rhms_pinned_conversations', JSON.stringify(next)); } catch (e) {}
      showStatusToast(pinned ? 'Conversation unpinned' : 'Conversation pinned');
      return next;
    });
  };

  const toggleMutedConversation = (conv) => {
    if (!conv) return;
    const key = convKey(conv);
    setMutedConversations((prev) => {
      const muted = prev.includes(key);
      const next = muted ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem('rhms_muted_conversations', JSON.stringify(next)); } catch (e) {}
      try { window.dispatchEvent(new Event('rhms:unread-changed')); } catch (e) {}
      showStatusToast(muted ? 'Conversation unmuted' : 'Conversation muted');
      return next;
    });
  };

  const markConversationRead = async () => {
    if (!selectedUser) return;
    try {
      await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
      setUnreadMap((m) => ({ ...m, [convKey(selectedUser)]: 0 }));
      try { window.dispatchEvent(new Event('rhms:unread-changed')); } catch (e) {}
      showStatusToast('Conversation marked as read');
    } catch (e) {
      showStatusToast(e?.message || 'Could not mark the conversation as read', 'error');
    }
  };

  const handleCopyUserId = async () => {
    if (!selectedUser) return;
    const ok = await copyToClipboard(String(selectedUser.id));
    showStatusToast(ok ? (selectedUser.type === 'group' ? 'Group ID copied to clipboard' : 'User ID copied to clipboard') : 'Could not copy the ID', ok ? 'success' : 'error');
  };

  const handleCopyUserEmail = async () => {
    if (!selectedUser?.email) { showStatusToast('No email address to copy', 'error'); return; }
    const ok = await copyToClipboard(selectedUser.email);
    showStatusToast(ok ? 'Email address copied to clipboard' : 'Could not copy the email address', ok ? 'success' : 'error');
  };

  const refreshConversation = async () => {
    if (!selectedUser) return;
    setMsgLoading(true);
    try {
      const data = await api.get(`/api/messages?conversationType=${selectedUser.type}&conversationId=${encodeURIComponent(selectedUser.id)}`);
      setMessages(Array.isArray(data) ? data : []);
      showStatusToast('Conversation refreshed');
    } catch (e) {
      showStatusToast(e?.message || 'Could not refresh the conversation', 'error');
    } finally {
      setMsgLoading(false);
    }
  };

  const openMessageSearch = () => {
    setShowMsgSearch(true);
    setTimeout(() => { try { msgSearchRef.current?.focus(); } catch (e) {} }, 30);
  };

  const canShowInFolder = (attachment) => {
    if (!attachment) return false;
    const w = typeof window !== 'undefined' ? window : {};
    const apiBridge = w.electron || w.desktop || w.rhmsDesktop;
    return !!(apiBridge && (typeof apiBridge.showItemInFolder === 'function' || typeof apiBridge.showInFolder === 'function' || typeof apiBridge.revealInFolder === 'function'));
  };

  const handleShowInFolder = async (attachment) => {
    if (!attachment) return;
    try {
      const w = typeof window !== 'undefined' ? window : {};
      const apiBridge = w.electron || w.desktop || w.rhmsDesktop;
      const fn = apiBridge && (apiBridge.showItemInFolder || apiBridge.showInFolder || apiBridge.revealInFolder);
      if (typeof fn === 'function') {
        const target = attachment.path || attachment.url;
        await fn(target);
        showStatusToast('Opened in folder');
        return;
      }
      showStatusToast('Show in Folder is not supported in this environment.', 'error');
    } catch (e) {
      showStatusToast('Could not show the file in folder.', 'error');
    }
  };

  const handleReply = (msg) => {
    if (!msg) return;
    setReplyTo(msg);
    setTimeout(() => { try { textareaRef.current?.focus(); } catch (e) {} }, 0);
  };

  const openForward = (msg) => { if (msg) setForwardTarget({ msg, dest: null }); };
  const handleForward = async (dest) => {
    if (!forwardTarget?.msg || !dest || forwarding) return;
    setForwarding(true);
    try {
      const msg = forwardTarget.msg;
      const content = String(msg.content || '').trim();
      const atts = Array.isArray(msg.attachments) ? msg.attachments.map(normalizeAttachment).filter(Boolean).map((a) => ({ name: a.name || attachmentName(a), path: a.path || a.url, size: a.size, type: a.type || '' })) : [];
      await api.post('/api/messages', { conversationType: dest.type, conversationId: dest.id, content, attachments: atts, replyTo: null });
      showStatusToast('Message forwarded');
      setForwardTarget(null);
    } catch (e) {
      showStatusToast(e?.message || 'Could not forward the message.', 'error');
    } finally {
      setForwarding(false);
    }
  };

  const openReport = (msg) => { if (msg) { setReportTarget(msg); setReportReason(''); } };
  const handleReport = async () => {
    if (!reportTarget || reporting) return;
    const reason = String(reportReason || '').trim() || 'No reason provided';
    setReporting(true);
    try {
      await api.post('/api/messages/report', { messageId: reportTarget.id, reason, conversationType: selectedUser?.type, conversationId: selectedUser?.id }).catch(() => null);
      showStatusToast('Message reported');
      setReportTarget(null);
      setReportReason('');
    } catch (e) {
      showStatusToast('Message reported');
      setReportTarget(null);
    } finally {
      setReporting(false);
    }
  };

  const fetchDirectory = useCallback(async () => {
    const [u, g, p] = await Promise.all([
      api.get('/api/users').catch(() => []),
      api.get('/api/groups').catch(() => []),
      api.get('/api/messages/conversation-peers').catch(() => []),
    ]);
    const usersList = Array.isArray(u) ? u : (u?.users || []);
    const peersList = Array.isArray(p) ? p : [];
    const byId = new Map();
    usersList.forEach((x) => { if (x && x.id != null) byId.set(String(x.id), x); });
    peersList.forEach((x) => { if (x && x.id != null && !byId.has(String(x.id))) byId.set(String(x.id), x); });
    return {
      users: Array.from(byId.values()),
      groups: Array.isArray(g) ? g : (g?.groups || []),
      peers: peersList,
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
        setConversationPeers(data.peers || []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchDirectory]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rhms_pinned_messages');
      if (raw) setPinnedByConv(JSON.parse(raw) || {});
    } catch (e) {}
    try {
      const raw = localStorage.getItem('rhms_pinned_conversations');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setPinnedConversations(list);
      }
    } catch (e) {}
    try {
      const raw = localStorage.getItem('rhms_muted_conversations');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setMutedConversations(list);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const mid = sp.get('messageId');
      if (mid) setHighlightMsgId(mid);
    } catch (e) {}
  }, []);

  // Keep the directory in sync with users/groups edited elsewhere in the app.
  useEffect(() => {
    let cancelled = false;
    const refreshDirectory = async () => {
      try {
        const data = await fetchDirectory();
        if (cancelled) return;
        setUsers(data.users);
        setGroups(data.groups);
        setConversationPeers(data.peers || []);
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

  const sections = buildSections(role, user, users, groups, t, {
    conversationPeers,
    previews,
    unreadMap,
    activity,
  });
  sections.sort((a, b) => {
    const aAct = Math.max(0, ...a.items.map((it) => activity[it.id] || 0));
    const bAct = Math.max(0, ...b.items.map((it) => activity[it.id] || 0));
    return bAct - aAct;
  });
  sections.forEach((s) => {
    s.items.sort((a, b) => {
      const aPinned = pinnedConversations.includes(a.type + ':' + a.id) ? 1 : 0;
      const bPinned = pinnedConversations.includes(b.type + ':' + b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (activity[b.id] || 0) - (activity[a.id] || 0);
    });
  });

  const openConversation = useCallback(async (conv) => {
    setSelectedUser(conv);
    setMessages([]);
    setText('');
    setAttachments([]);
    setReplyTo(null);
    setEditingId(null);
    setDeleteTarget(null);
    setShowMsgSearch(false);
    setMsgSearch('');
    setMsgSearchIndex(0);
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
    if (!highlightMsgId || !messages.length) return;
    const target = document.getElementById('cm-msg-' + highlightMsgId);
    if (target) {
      try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      const t = setTimeout(() => setHighlightMsgId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [highlightMsgId, messages, selectedUser]);

  // Keep the selected conversation's preview in sync with its message list so
  // sending, editing, deleting or polling a message updates the left panel.
  useEffect(() => {
    if (!selectedUser || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const key = selectedUser.type + ':' + selectedUser.id;
    setPreviews((prev) => {
      const next = {
        content: last.content || '',
        attachments: Array.isArray(last.attachments) ? last.attachments : [],
        senderId: last.sender_id,
        senderName: last.sender_name,
        createdAt: last.created_at,
      };
      const cur = prev[key];
      if (cur && cur.createdAt === next.createdAt && cur.content === next.content && cur.senderId === next.senderId) return prev;
      return { ...prev, [key]: next };
    });
  }, [messages, selectedUser]);

  useEffect(() => {
    const onClick = (e) => {
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttachMenu(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);



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
    // Re-sync presence after (re)connecting in case events were missed while
    // the stream was down.
    es.onopen = () => {
      fetchDirectory()
        .then((data) => { setUsers(data.users); setGroups(data.groups); setConversationPeers(data.peers || []); })
        .catch(() => {});
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || data.type === 'init' || data.message === 'Connected') return;
        const d = data.data || {};
        if (d.type === 'presence') {
          if (d.userId != null) {
            const pid = String(d.userId);
            setUsers((prev) => prev.map((u) => (String(u.id) === pid ? { ...u, online: !!d.online } : u)));
          }
          return;
        }
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
        const previewKey = convType + ':' + convId;
        // Optimistically show the incoming message immediately, then reconcile
        // with the authoritative latest record + unread count from the server.
        if (d.preview) {
          setPreviews((prev) => ({
            ...prev,
            [previewKey]: {
              content: d.preview,
              attachments: [],
              senderId: d.userId,
              senderName: d.userName,
              createdAt: data.timestamp || new Date().toISOString(),
            },
          }));
        }
        if (convType === 'direct' && d.userId && role === 'admin') {
          setUsers((prev) => {
            if (prev.some((u) => String(u.id) === String(d.userId))) return prev;
            return [...prev, { id: d.userId, name: d.userName || 'User', role: d.userRole || 'client', avatar: d.userAvatar || null }];
          });
          setConversationPeers((prev) => {
            if (prev.some((u) => String(u.id) === String(d.userId))) return prev;
            return [...prev, { id: d.userId, name: d.userName || 'User', role: d.userRole || 'client', avatar: d.userAvatar || null }];
          });
        }
        api.get(`/api/messages/unread-count?conversationType=${convType}&conversationId=${encodeURIComponent(convId)}`)
          .then((r) => {
            const isOpen = selectedConvRef.current === previewKey;
            setUnreadMap((m) => ({ ...m, [previewKey]: isOpen ? 0 : (r?.count || 0) }));
            if (r?.lastMessage) {
              setPreviews((prev) => ({ ...prev, [previewKey]: r.lastMessage }));
            }
            if (isOpen) {
              api.put('/api/messages/read', { conversationType: convType, conversationId: convId })
                .then(() => { try { window.dispatchEvent(new Event('rhms:unread-changed')); } catch {} })
                .catch(() => {});
            }
          })
          .catch(() => {});
      } catch (e) {}
    };
    return () => { try { es.close(); } catch (e) {} };
  }, [user?.id, fetchDirectory]);

  // Fallback polling: keep reordering working even if SSE is unavailable
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const pollAll = async () => {
      const flat = (sections || []).flatMap((s) => s.items || []);
      for (const it of flat) {
        if (cancelled) return;
        try {
          const key = it.type + ':' + it.id;
          const r = await api.get(`/api/messages/unread-count?conversationType=${it.type}&conversationId=${encodeURIComponent(it.id)}`);
          if (cancelled || !r) continue;
          const isOpen = selectedConvRef.current === key;
          setUnreadMap((m) => ({ ...m, [key]: isOpen ? 0 : (r.count || 0) }));
          const last = r.lastMessage;
          if (!last) {
            setPreviews((prev) => (prev[key] ? { ...prev, [key]: null } : prev));
            continue;
          }
          setPreviews((prev) => ({ ...prev, [key]: last }));
          if (String(last.senderId) !== String(user.id)) {
            const ts = new Date(last.createdAt).getTime() || Date.now();
            setActivity((prev) => {
              const prevTs = prev[it.id] || 0;
              if (ts <= prevTs) return prev;
              return { ...prev, [it.id]: Math.max(ts, prevTs + 1) };
            });
          }
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
          const key = it.type + ':' + it.id;
          const r = await api.get(`/api/messages/unread-count?conversationType=${it.type}&conversationId=${encodeURIComponent(it.id)}`);
          if (cancelled) continue;
          setUnreadMap((m) => ({ ...m, [key]: r?.count || 0 }));
          if (r?.lastMessage) setPreviews((prev) => ({ ...prev, [key]: r.lastMessage }));
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

  const uploadAttachments = async (files, endpoint = '/api/upload') => {
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append('file', files[i]);
      try {
        const fileType = String(files[i].type || '').toLowerCase();
        const isAudioFile = fileType.startsWith('audio/') || (!fileType.startsWith('video/') && AUDIO_EXT_RE.test(String(files[i].name || '')));
        const uploadUrl = endpoint === '/api/upload/voice' ? endpoint : (isAudioFile ? '/api/upload/voice' : endpoint);
        const res = await api.upload(uploadUrl, fd);
        uploaded.push({ name: files[i].name, path: res.path, size: files[i].size || res.size || 0, type: res.type || files[i].type || '', private: !!res.private });
      } catch (e) {
        console.error(e);
        throw e;
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
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

  const finalizeVoiceRecording = (mimeType) => {
    const startedAt = recordStartRef.current || Date.now();
    const elapsed = Math.max(0, Date.now() - startedAt);
    const cancelled = recCancelRef.current;
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    recCancelRef.current = false;
    cleanupRecorder();
    setRecording(false);
    setAudioLevels([]);
    if (cancelled) {
      setRecordingTime(0);
      return;
    }
    const type = mimeType || chunks[0]?.type || 'audio/webm';
    const blob = new Blob(chunks, { type });
    if (!blob.size || elapsed < 500) {
      setRecordingTime(0);
      setVoiceError('Recording is too short. Please try again.');
      return;
    }
    const ext = /ogg/i.test(type) ? 'ogg' : /mp4|m4a|aac/i.test(type) ? 'm4a' : 'webm';
    const url = URL.createObjectURL(blob);
    setRecordedAudio({
      blob,
      url,
      type,
      duration: Math.max(1, Math.round(elapsed / 1000)),
      name: `voice-message-${Date.now()}.${ext}`,
    });
    setRecordingTime(Math.max(1, Math.round(elapsed / 1000)));
    setVoiceError('');
  };

  const startVoiceRecording = async () => {
    if (!selectedUser || sendingVoice || voiceStartRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }
    voiceStartRef.current = true;
    if (recordedAudio) deleteRecordedVoice();
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = candidates.find((m) => {
        try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; }
      });
      let recorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      audioChunksRef.current = [];
      recCancelRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => finalizeVoiceRecording(recorder.mimeType || mimeType);
      recorder.onerror = () => {
        recCancelRef.current = true;
        setVoiceError('Recording failed. Please try again.');
        try { recorder.stop(); } catch (e) {}
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setRecordingTime(0);
      setAudioLevels(Array.from({ length: 24 }, () => 4));
      setRecording(true);
      voiceStartRef.current = false;
      recordTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 250);
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          audioContextRef.current = ctx;
          analyserRef.current = analyser;
          const bins = new Uint8Array(analyser.frequencyBinCount);
          waveformTimerRef.current = setInterval(() => {
            try {
              analyser.getByteFrequencyData(bins);
              setAudioLevels(Array.from(bins.slice(0, 24)).map((v) => Math.max(4, Math.round((v / 255) * 26))));
            } catch (e) {}
          }, 120);
        }
      } catch (e) {}
    } catch (err) {
      voiceStartRef.current = false;
      cleanupRecorder();
      setRecording(false);
      setRecordingTime(0);
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setVoiceError(denied
        ? 'Microphone permission denied. Allow microphone access in your browser and try again.'
        : (err?.message || 'Unable to access the microphone.'));
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch (e) {
      cleanupRecorder();
      setRecording(false);
    }
  };

  const discardVoiceRecording = () => {
    recCancelRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (e) { cleanupRecorder(); setRecording(false); }
    } else {
      cleanupRecorder();
      setRecording(false);
      setRecordingTime(0);
      setAudioLevels([]);
    }
  };

  const deleteRecordedVoice = () => {
    setRecordedAudio(null);
    setRecordingTime(0);
    setVoiceError('');
  };

  const sendRecordedVoice = async () => {
    if (!recordedAudio || !selectedUser || sendingVoice) return;
    setSendingVoice(true);
    setVoiceError('');
    try {
      const file = new File([recordedAudio.blob], recordedAudio.name, { type: recordedAudio.type || recordedAudio.blob?.type || 'audio/webm' });
      const uploaded = await uploadAttachments([file], '/api/upload/voice');
      if (!uploaded.length) throw new Error('Voice message upload failed. Please try again.');
      const att = { ...uploaded[0], type: recordedAudio.type || recordedAudio.blob?.type || uploaded[0].type || 'audio/webm', duration: recordedAudio.duration };
      const created = await api.post('/api/messages', {
        conversationType: selectedUser.type,
        conversationId: selectedUser.id,
        content: '',
        attachments: [att],
        replyTo: replyTo?.id || null,
      });
      setMessages((prev) => [...prev, created]);
      setReplyTo(null);
      deleteRecordedVoice();
      await api.put('/api/messages/read', { conversationType: selectedUser.type, conversationId: selectedUser.id });
    } catch (e) {
      setVoiceError(e?.message || 'Failed to send voice message.');
    } finally {
      setSendingVoice(false);
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

  const totalUnread = flatItems.reduce((a, it) => a + (unreadMap[it.type + ':' + it.id] || 0), 0);

  const msgSearchTerm = msgSearch.trim().toLowerCase();
  const msgSearchMatches = msgSearchTerm
    ? messages.filter((m) => String(m.content || '').toLowerCase().includes(msgSearchTerm))
    : [];
  const msgSearchMatchIds = msgSearchMatches.map((m) => m.id);

  useEffect(() => { setMsgSearchIndex(0); }, [msgSearch]);

  const jumpToMessageMatch = (dir) => {
    if (!msgSearchMatchIds.length) return;
    setMsgSearchIndex((prev) => {
      const len = msgSearchMatchIds.length;
      const next = ((prev + dir) % len + len) % len;
      const id = msgSearchMatchIds[next];
      setHighlightMsgId(id);
      setTimeout(() => {
        const el = document.getElementById('cm-msg-' + id);
        if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
      }, 0);
      return next;
    });
  };

  useEffect(() => {
    if (!showMsgSearch || !msgSearchTerm || !msgSearchMatchIds.length) return undefined;
    const id = msgSearchMatchIds[0];
    setHighlightMsgId(id);
    const timer = setTimeout(() => {
      const el = document.getElementById('cm-msg-' + id);
      if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgSearchTerm, showMsgSearch]);

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
        .cm-root .cm-rec-dot { animation: cmRecPulse 1.1s ease-in-out infinite; }
        @keyframes cmRecPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.82); } }

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
                        const preview = previews[key];
                        const previewBody = buildPreviewText(preview, user?.id);
                        const previewStamp = previewTimeLabel(preview?.createdAt);
                        const isPinnedItem = pinnedConversations.includes(key);
                        const isMutedItem = mutedConversations.includes(key);
                        const showNewMessage = unread > 0 && !isActive && !isMutedItem;
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
                                {isPinnedItem && <span title="Pinned" style={{ display: 'inline-flex', flexShrink: 0 }}><Pin size={11} color={T.muted} /></span>}
                                {isMutedItem && <span title="Muted" style={{ display: 'inline-flex', flexShrink: 0 }}><BellOff size={11} color={T.muted} /></span>}
                                {(previewStamp || it.time) ? <span style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>{previewStamp || it.time}</span> : null}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, minWidth: 0 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? '#10B981' : (dark ? '#64748B' : '#94A3B8'), flexShrink: 0 }} />
                                {isGroup ? (
                                  <>
                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: theme.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{roleLabel}</span>
                                    <span style={{ fontSize: 10.5, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {statusLabel}</span>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 10.5, fontWeight: 600, color: online ? '#10B981' : T.muted, whiteSpace: 'nowrap' }}>{statusLabel}</span>
                                )}
                                {showNewMessage && (
                                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    <span
                                      className="cm-new-message"
                                      style={{
                                        padding: '1px 7px',
                                        borderRadius: 6,
                                        background: '#2563EB',
                                        color: '#FFFFFF',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        lineHeight: 1.3,
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      New message
                                    </span>
                                    <span
                                      className="cm-unread-pill"
                                      style={{
                                        minWidth: 16,
                                        height: 16,
                                        padding: '0 5px',
                                        borderRadius: 999,
                                        background: '#2563EB',
                                        color: '#FFFFFF',
                                        fontSize: 9.5,
                                        fontWeight: 800,
                                        pointerEvents: 'none',
                                      }}
                                    >
                                      {unread}
                                    </span>
                                  </span>
                                )}
                              </div>
                              {(previewBody || it.last) ? (
                                <div
                                  title={previewBody || it.last}
                                  style={{
                                    marginTop: 3,
                                    marginLeft: -7,
                                    padding: '2px 7px',
                                    borderRadius: 7,
                                    fontSize: 11,
                                    lineHeight: 1.35,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    color: T.muted,
                                    fontWeight: 400,
                                    background: 'transparent',
                                  }}
                                >
                                  {previewBody || it.last}
                                </div>
                              ) : null}
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
                  <button
                    type="button"
                    data-conv-menu-toggle="true"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      if (attachmentMenu?.type === 'conversation') { setAttachmentMenu(null); return; }
                      openConversationMenu(e);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={attachmentMenu?.type === 'conversation'}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer' }}
                    title="Conversation options"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
              {showMsgSearch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid ' + T.border, background: T.surface }}>
                  <Search size={14} color={T.muted} />
                  <input
                    ref={msgSearchRef}
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); jumpToMessageMatch(e.shiftKey ? -1 : 1); }
                      if (e.key === 'Escape') { setShowMsgSearch(false); setMsgSearch(''); }
                    }}
                    placeholder="Search in conversation..."
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.text }}
                  />
                  <span style={{ fontSize: 11.5, color: T.muted, whiteSpace: 'nowrap' }}>
                    {msgSearchTerm ? `${msgSearchMatchIds.length ? msgSearchIndex + 1 : 0} / ${msgSearchMatchIds.length}` : '0 / 0'}
                  </span>
                  <button type="button" onClick={() => jumpToMessageMatch(-1)} disabled={!msgSearchMatchIds.length} title="Previous match" style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: msgSearchMatchIds.length ? 'pointer' : 'not-allowed', opacity: msgSearchMatchIds.length ? 1 : 0.5, fontSize: 10, lineHeight: 1 }}>▲</button>
                  <button type="button" onClick={() => jumpToMessageMatch(1)} disabled={!msgSearchMatchIds.length} title="Next match" style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: msgSearchMatchIds.length ? 'pointer' : 'not-allowed', opacity: msgSearchMatchIds.length ? 1 : 0.5, fontSize: 10, lineHeight: 1 }}>▼</button>
                  <button type="button" onClick={() => { setShowMsgSearch(false); setMsgSearch(''); }} title="Close search" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer' }}><X size={14} /></button>
                </div>
              )}
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
                  const isSelectedMsg = selectedMessages.includes(m.id);
                  const isPinnedMsg = isPinned(m.id);
                  const isHighlighted = highlightMsgId && String(m.id) === String(highlightMsgId);
                  const isSearchMatch = !!msgSearchTerm && String(m.content || '').toLowerCase().includes(msgSearchTerm);
                  return (
                    <div key={m.id || idx} id={m.id ? 'cm-msg-' + m.id : undefined}>
                      {dateStr !== prevDate && <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 11, color: T.muted }}>{dateStr}</div>}
                      <div
                        onClick={(e) => {
                          if (!isSelectedMsg || editingId === m.id) return;
                          const t = e.target;
                          if (t && t.closest && t.closest('button, a, input, textarea, select, [contenteditable="true"], audio, video, [role="menu"], [role="menuitem"], [data-attachment-item="true"]')) return;
                          toggleSelectMessage(m);
                        }}
                        style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', marginBottom: 10, gap: 8, alignItems: 'flex-end', background: isSelectedMsg ? (dark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)') : isSearchMatch ? (dark ? 'rgba(250,204,21,0.16)' : 'rgba(250,204,21,0.24)') : isHighlighted ? (dark ? 'rgba(250,204,21,0.12)' : 'rgba(250,204,21,0.18)') : 'transparent', borderRadius: 10, padding: (isSelectedMsg || isHighlighted || isSearchMatch) ? '4px 6px' : 0, outline: isSearchMatch ? '2px solid #F59E0B' : isPinnedMsg ? ('1px solid ' + (dark ? 'rgba(250,204,21,0.35)' : '#FCD34D')) : 'none', cursor: (isSelectedMsg && editingId !== m.id) ? 'pointer' : 'default' }}
                      >
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
                            <div onContextMenu={(e) => openMessageMenu(e, m)} style={{ position: 'relative', background: own ? (dark ? '#DBEAFE22' : '#EAF2FF') : (dark ? '#F1F5F922' : '#F3F4F6'), color: own ? (dark ? '#E2E8F0' : '#1E3A8A') : (dark ? '#E2E8F0' : '#1F2937'), padding: '10px 14px', borderRadius: 18, border: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : (dark ? '1px solid #475569' : '1px solid #E5E7EB'), boxShadow: own ? '0 4px 12px rgba(37,99,235,0.14)' : '0 4px 12px rgba(0,0,0,0.08)', backdropFilter: 'blur(2px)' }}>
                              {/* tail */}
                              <span style={{ position: 'absolute', bottom: -7, [own ? 'right' : 'left']: 16, width: 14, height: 14, background: 'inherit', transform: 'rotate(45deg)', borderRadius: 3, borderRight: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : 'none', borderBottom: own ? (dark ? '1px solid #2563EB55' : '1px solid #93C5FD') : 'none', borderLeft: !own ? (dark ? '1px solid #475569' : '1px solid #E5E7EB') : 'none', borderTop: !own ? (dark ? '1px solid #475569' : '1px solid #E5E7EB') : 'none', zIndex: 0, boxShadow: own ? '2px 2px 6px rgba(37,99,235,0.08)' : '2px 2px 6px rgba(0,0,0,0.05)' }} />
                              <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11, opacity: 0.9, flexWrap: 'wrap', textAlign: own ? 'right' : 'left', justifyContent: own ? 'flex-end' : 'flex-start' }}>
                                  <span style={{ fontWeight: 700, color: own ? (dark ? '#BFDBFE' : '#1D4ED8') : (dark ? '#E2E8F0' : '#111827') }}>{own ? (m.sender_name || 'You') : (m.sender_name || 'Unknown')}</span>
                                  <span style={{ color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280'), fontWeight: 500 }}>{t('role.' + (m.sender_role === 'support' ? 'escalationTeam' : m.sender_role)) || m.sender_role}</span>
                                  <span style={{ color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280') }}>{d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                  {m.edited_at && <span style={{ fontStyle: 'italic', color: own ? (dark ? '#93C5FD' : '#2563EB') : (dark ? '#94A3B8' : '#6B7280') }}>(edited)</span>}
                                  {isPinnedMsg && <span title="Pinned" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: own ? (dark ? '#FCD34D' : '#B45309') : (dark ? '#FCD34D' : '#B45309'), fontWeight: 600 }}><Pin size={11} /> Pinned</span>}
                                </div>
                                {m.content ? <div style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</div> : null}
                                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: own ? 'flex-end' : 'flex-start' }}>
                                    {(() => {
                                      const all = m.attachments.map(normalizeAttachment).filter(Boolean);
                                      const indexed = all.map((a, index) => ({ a, index }));
                                      const audios = indexed.filter(({ a }) => isAudioAttachment(a));
                                      const media = all.filter((a) => !isAudioAttachment(a) && (isImageAttachment(a) || isVideoAttachment(a)));
                                      const docs = all.filter((a) => !isAudioAttachment(a) && !isImageAttachment(a) && !isVideoAttachment(a));
                                      return (
                                        <>
                                          {audios.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: own ? 'flex-end' : 'flex-start' }}>
                                              {audios.map(({ a, index }) => (
                                                <div key={index} onContextMenu={(e) => openAttachmentMenu(e, a, attachmentName(a), m.id, m)}>
                                                  <AudioPlayer src={`/api/messages/${encodeURIComponent(m.id)}/attachments/${index}/audio`} duration={a.duration} dark={dark} T={T} maxWidth={280} />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {media.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: media.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 4, maxWidth: 300, borderRadius: 8, overflow: 'hidden' }}>
                                              {media.map((a, i) => {
                                                const url = attachmentUrl(a);
                                                const name = attachmentName(a);
                                                if (isImageAttachment(a)) {
                                                  return (
                                                    <img key={i} src={url} alt={name} onClick={() => setPreviewMedia({ type: 'image', url })} onContextMenu={(e) => openAttachmentMenu(e, a, name, m.id, m)} style={{ width: '100%', height: media.length > 1 ? 120 : 'auto', maxHeight: 260, objectFit: 'cover', cursor: 'pointer', display: 'block', borderRadius: 6 }} />
                                                  );
                                                }
                                                return (
                                                  <div key={i} onClick={() => setPreviewMedia({ type: 'video', url })} onContextMenu={(e) => openAttachmentMenu(e, a, name, m.id, m)} style={{ position: 'relative', width: '100%', height: media.length > 1 ? 120 : 180, background: '#000', cursor: 'pointer', borderRadius: 6, overflow: 'hidden' }}>
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
                                            const icon = /\.pdf$/i.test(name) ? 'PDF' : /\.(docx?)$/i.test(name) ? 'DOC' : /\.(xlsx?|csv)$/i.test(name) ? 'XLS' : /\.(pptx?)$/i.test(name) ? 'PPT' : /\.xml$/i.test(name) ? 'XML' : /\.(mp3|wav|ogg|m4a|aac|flac|oga)$/i.test(name) ? 'AUD' : 'FILE';
                                            const kind = documentKind(name);
                                            const baseStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: '1px solid ' + T.border, textDecoration: 'none', color: own ? (dark ? '#BFDBFE' : '#1D4ED8') : T.accent, maxWidth: 300, boxSizing: 'border-box', fontFamily: 'inherit', WebkitAppearance: 'none' };
                                            if (kind) {
                                              return (
                                                <button key={i} type="button" onClick={() => openDocumentChooser(a, m.id)} onContextMenu={(e) => openAttachmentMenu(e, a, name, m.id, m)} title="Open Document With" aria-label={`Open ${name}`} style={{ ...baseStyle, cursor: 'pointer', textAlign: 'left' }}>
                                                  <div style={{ width: 36, height: 36, borderRadius: 8, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{icon}</div>
                                                  <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                                    <div style={{ fontSize: 10, color: T.muted }}>{ext}{sizeLabel ? ' · ' + sizeLabel : ''}</div>
                                                  </div>
                                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Open<ChevronRight size={13} /></span>
                                                </button>
                                              );
                                            }
                                            const openHref = url;
                                            return (
                                              <a key={i} href={openHref} target="_blank" rel="noreferrer" onContextMenu={(e) => openAttachmentMenu(e, a, name, m.id, m)} style={baseStyle}>
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
                {recording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + T.border, background: T.surface, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="cm-rec-dot" style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.18)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Recording</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{formatClock(recordingTime)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 26, flex: 1, minWidth: 90 }}>
                      {audioLevels.map((h, i) => (
                        <span key={i} style={{ width: 3, height: h, borderRadius: 2, background: dark ? '#60A5FA' : '#2563EB', opacity: 0.85 }} />
                      ))}
                    </div>
                    <button type="button" onClick={discardVoiceRecording} title="Cancel recording" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={15} /></button>
                    <button type="button" onClick={stopVoiceRecording} title="Stop recording" style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}><Square size={12} fill="currentColor" /> Stop</button>
                  </div>
                )}
                {recordedAudio && !recording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + T.border, background: T.surface, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 230px', minWidth: 0 }}>
                      <AudioPlayer src={recordedAudio.url} duration={recordedAudio.duration} dark={dark} T={T} maxWidth={260} />
                    </div>
                    <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Voice message</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" onClick={deleteRecordedVoice} title="Delete recording" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={15} /></button>
                      <button type="button" onClick={sendRecordedVoice} disabled={sendingVoice} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: T.accent, color: '#fff', cursor: sendingVoice ? 'not-allowed' : 'pointer', opacity: sendingVoice ? 0.6 : 1, fontSize: 12, fontWeight: 700 }}>{sendingVoice ? 'Sending…' : 'Send Voice'}</button>
                    </div>
                  </div>
                )}
                {voiceError && (
                  <div style={{ fontSize: 11.5, color: '#DC2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{voiceError}</span>
                    <button type="button" onClick={() => setVoiceError('')} style={{ border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={13} /></button>
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div ref={attachRef} style={{ position: 'relative' }} onMouseEnter={openAttachMenu} onMouseLeave={scheduleCloseAttachMenu}>
                     <button style={{ padding: 10, borderRadius: 10, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="Attach"><Paperclip size={18} color={T.text2} /></button>
                     {showAttachMenu && (
                       <div onMouseEnter={openAttachMenu} onMouseLeave={scheduleCloseAttachMenu} style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 0, paddingBottom: 8, zIndex: 60 }}>
                         <div style={{ background: T.panel, border: '1px solid ' + T.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 6, minWidth: 190 }}>
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
                  <div ref={emojiRef} style={{ position: 'relative' }} onMouseEnter={openEmojiPicker} onMouseLeave={scheduleCloseEmojiPicker}>
                     <button style={{ padding: 10, borderRadius: 10, border: '1px solid ' + T.border, background: T.panel, cursor: 'pointer' }} title="Emoji"><Smile size={18} color={T.text2} /></button>
                     {showEmojiPicker && (
                       <div onMouseEnter={openEmojiPicker} onMouseLeave={scheduleCloseEmojiPicker} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 0, paddingBottom: 8, zIndex: 60 }}>
                         <div style={{ background: T.panel, border: '1px solid ' + T.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 320, maxHeight: 360, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                       </div>
                     )}
                    </div>
                   <button
                     type="button"
                     onClick={recording ? stopVoiceRecording : startVoiceRecording}
                     disabled={!selectedUser || sendingVoice}
                     title={recording ? 'Stop recording' : 'Record voice message'}
                     style={{ padding: 10, borderRadius: 10, border: '1px solid ' + (recording ? '#EF4444' : T.border), background: recording ? 'rgba(239,68,68,0.12)' : T.panel, cursor: (!selectedUser || sendingVoice) ? 'not-allowed' : 'pointer', opacity: (!selectedUser || sendingVoice) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                   >
                     <Mic size={18} color={recording ? '#EF4444' : T.text2} />
                   </button>
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
      {attachmentMenu && createPortal(
        (() => {
          const am = attachmentMenu;
          const msg = am.message || null;
          const isMsgMenu = am.type === 'message';
          const isConvMenu = am.type === 'conversation';
          const item = (key, label, IconComp, onClick, opts = {}) => ({ key, label, IconComp, onClick, ...opts });
          const sep = (key) => ({ key, divider: true });
          const canDeleteMsg = !!(msg && (msg.sender_id === user?.id || user?.role === 'admin'));
          const pinnedConv = isConvPinned(selectedUser);
          const mutedConv = isConvMuted(selectedUser);
          const actions = isConvMenu ? [
            item('info', selectedUser?.type === 'group' ? 'View group info' : 'View contact info', Info, () => setContactInfo(selectedUser)),
            item('search', 'Search in conversation', Search, openMessageSearch),
            sep('c1'),
            item('read', 'Mark as read', CheckCheck, markConversationRead),
            item(pinnedConv ? 'unpin-conv' : 'pin-conv', pinnedConv ? 'Unpin conversation' : 'Pin conversation', pinnedConv ? PinOff : Pin, () => togglePinnedConversation(selectedUser)),
            item(mutedConv ? 'unmute-conv' : 'mute-conv', mutedConv ? 'Unmute conversation' : 'Mute conversation', mutedConv ? Bell : BellOff, () => toggleMutedConversation(selectedUser)),
            ...(selectedUser?.email ? [item('copy-email', 'Copy email address', Copy, handleCopyUserEmail)] : []),
            item('copy-id', selectedUser?.type === 'group' ? 'Copy group ID' : 'Copy user ID', Copy, handleCopyUserId),
            sep('c2'),
            item('refresh', 'Refresh conversation', RefreshCw, refreshConversation),
          ] : isMsgMenu ? [
            item('reply', 'Reply', Reply, () => { if (msg) handleReply(msg); }),
            item(isPinned(msg?.id) ? 'unpin' : 'pin', isPinned(msg?.id) ? 'Unpin' : 'Pin', Pin, () => { if (msg) { const was = isPinned(msg.id); togglePinMessage(msg); showStatusToast(was ? 'Message unpinned' : 'Message pinned'); } }),
            sep('s1'),
            item('copy-text', 'Copy Message Text', Copy, () => { if (msg) handleCopyMessageText(msg); }),
            item('copy-link', 'Copy Message Link', Link2, () => { if (msg) handleCopyMessageLink(msg); }),
            sep('s2'),
            item('forward', 'Forward', Forward, () => { if (msg) openForward(msg); }),
            item(isSelected(msg?.id) ? 'deselect' : 'select', isSelected(msg?.id) ? 'Deselect' : 'Select', CheckSquare, () => { if (msg) { const was = isSelected(msg.id); toggleSelectMessage(msg); showStatusToast(was ? 'Message deselected' : 'Message selected'); } }),
            item('report', 'Report', Flag, () => { if (msg) openReport(msg); }),
            ...(canDeleteMsg ? [sep('s3'), item('delete', 'Delete', Trash2, () => { if (msg) requestDelete(msg); }, { danger: true })] : []),
          ] : [
            item('reply', 'Reply', Reply, () => { if (msg) handleReply(msg); else showStatusToast('Reply is not available for this attachment.', 'error'); }),
            item(isPinned(msg?.id) ? 'unpin' : 'pin', isPinned(msg?.id) ? 'Unpin' : 'Pin', Pin, () => { if (msg) { const was = isPinned(msg.id); togglePinMessage(msg); showStatusToast(was ? 'Message unpinned' : 'Message pinned'); } else { showStatusToast('Pin is not available for this attachment.', 'error'); } }),
            ...(canShowInFolder(am) ? [sep('s1'), item('show-folder', 'Show in Folder', FolderOpen, () => { handleShowInFolder(am); })] : []),
            item('save-as', 'Save As...', Save, () => { handleDownloadAttachment(am); }),
            sep('s2'),
            item('copy-filename', 'Copy Filename', Copy, () => { handleCopyFilename(am.name); }),
            item('copy-link', 'Copy Message Link', Link2, () => { if (msg) handleCopyMessageLink(msg); else showStatusToast('Message link is not available.', 'error'); }),
            sep('s3'),
            item('forward', 'Forward', Forward, () => { if (msg) openForward(msg); else showStatusToast('Forward is not available for this attachment.', 'error'); }),
            item('report', 'Report', Flag, () => { if (msg) openReport(msg); else showStatusToast('Report is not available for this attachment.', 'error'); }),
            item(isSelected(msg?.id) ? 'deselect' : 'select', isSelected(msg?.id) ? 'Deselect' : 'Select', CheckSquare, () => { if (msg) { const was = isSelected(msg.id); toggleSelectMessage(msg); showStatusToast(was ? 'Message deselected' : 'Message selected'); } else { showStatusToast('Select is not available for this attachment.', 'error'); } }),
          ];
          const iconColor = (a) => (a.danger ? '#EF4444' : (dark ? '#C7D2FE' : '#475569'));
          return (
            <div
              ref={attachmentMenuRef}
              role="menu"
              aria-label={isConvMenu ? 'Conversation actions' : 'Attachment actions'}
              onContextMenu={(e) => e.preventDefault()}
              style={{ position: 'fixed', top: am.y, left: am.x, zIndex: 4000, minWidth: 240, maxWidth: 'calc(100vw - 16px)', background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, boxShadow: dark ? '0 20px 48px rgba(0,0,0,0.55)' : '0 20px 48px rgba(15,23,42,0.16)', padding: '6px 0', userSelect: 'none', overflow: 'hidden' }}
            >
              {actions.map((a) => a.divider ? (
                <div key={a.key} style={{ height: 1, background: T.border, margin: '6px 10px' }} />
              ) : (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  disabled={a.disabled}
                  onClick={() => { setAttachmentMenu(null); a.onClick(); }}
                  onMouseEnter={(e) => { if (a.disabled) return; e.currentTarget.style.background = T.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', cursor: a.disabled ? 'not-allowed' : 'pointer', color: a.danger ? '#EF4444' : T.text, fontSize: 13.5, fontWeight: 500, textAlign: 'left', opacity: a.disabled ? 0.45 : 1, transition: 'background 0.12s ease' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, color: iconColor(a), flexShrink: 0 }}><a.IconComp size={18} strokeWidth={1.8} /></span>
                  <span style={{ flex: 1 }}>{a.label}</span>
                </button>
              ))}
            </div>
          );
        })(),
        document.body
      )}

      {contactInfo && createPortal(
        <div
          onClick={() => setContactInfo(null)}
          style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4001, padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Contact info"
            style={{ width: '100%', maxWidth: 400, background: T.panel, border: '1px solid ' + T.border, borderRadius: 16, boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.6)' : '0 24px 60px rgba(15,23,42,0.2)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderBottom: '1px solid ' + T.border, background: T.surface }}>
              <Avatar user={{ name: contactInfo.name, avatar: contactInfo.avatar }} size={46} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactInfo.name}</div>
                <div style={{ fontSize: 12, color: T.text2 }}>
                  {contactInfo.type === 'group' ? `${contactInfo.members?.length || 0} members` : (contactInfo.online ? t('common.online') : t('common.offline'))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContactInfo(null)}
                aria-label="Close contact info"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Type</div>
                <div style={{ fontSize: 13.5, color: T.text }}>{contactInfo.type === 'group' ? 'Group chat' : 'Direct message'}</div>
              </div>
              {contactInfo.type !== 'group' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</div>
                  <div style={{ fontSize: 13.5, color: T.text }}>{t('role.' + (contactInfo.role === 'support' ? 'escalationTeam' : contactInfo.role)) || contactInfo.role}</div>
                </div>
              )}
              {contactInfo.email && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</div>
                  <div style={{ fontSize: 13.5, color: T.text, wordBreak: 'break-all' }}>{contactInfo.email}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{contactInfo.type === 'group' ? 'Group ID' : 'User ID'}</div>
                <div style={{ fontSize: 13.5, color: T.text, wordBreak: 'break-all' }}>{contactInfo.id}</div>
              </div>
              {contactInfo.type === 'group' && Array.isArray(contactInfo.members) && contactInfo.members.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Members</div>
                  <div style={{ fontSize: 13.5, color: T.text }}>{contactInfo.members.map((m) => m?.name).filter(Boolean).join(', ')}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid ' + T.border }}>
              <button
                type="button"
                onClick={handleCopyUserId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                <Copy size={14} /> Copy ID
              </button>
              {contactInfo.email && (
                <button
                  type="button"
                  onClick={handleCopyUserEmail}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  <Copy size={14} /> Copy Email
                </button>
              )}
              <button
                type="button"
                onClick={() => setContactInfo(null)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: T.btn, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
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
      <OpenWithDialog
        open={!!openDoc}
        filePath={openDoc?.path}
        fileName={openDoc?.name}
        messageId={openDoc?.messageId}
        onClose={() => setOpenDoc(null)}
      />
      {forwardTarget && createPortal(
        <div onClick={() => { if (!forwarding) setForwardTarget(null); }} style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4002, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, padding: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 10 }}>Forward message</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Choose a conversation to forward this attachment message to.</div>
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid ' + T.border, borderRadius: 10, padding: 6 }}>
              {sections.flatMap((s) => s.items).filter((it) => !(selectedUser && it.type === selectedUser.type && String(it.id) === String(selectedUser.id))).map((it) => (
                <button key={it.type + ':' + it.id} type="button" disabled={forwarding} onClick={() => handleForward(it)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: forwarding ? 'not-allowed' : 'pointer', textAlign: 'left' }} onMouseEnter={(e) => { e.currentTarget.style.background = T.hover; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <Avatar user={{ name: it.name, avatar: it.avatar }} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{it.type === 'group' ? 'Group' : (t('role.' + (it.role === 'support' ? 'escalationTeam' : it.role)) || it.role)}</div>
                  </div>
                </button>
              ))}
              {sections.flatMap((s) => s.items).filter((it) => !(selectedUser && it.type === selectedUser.type && String(it.id) === String(selectedUser.id))).length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: T.muted }}>No other conversations available.</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => setForwardTarget(null)} disabled={forwarding} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {reportTarget && createPortal(
        <div onClick={() => { if (!reporting) setReportTarget(null); }} style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4002, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 420, background: T.panel, border: '1px solid ' + T.border, borderRadius: 14, padding: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Report message</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Tell us why you are reporting this message.</div>
            <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Reason (optional)" rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid ' + T.border, background: T.input, color: T.text, resize: 'vertical', fontSize: 13 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setReportTarget(null)} disabled={reporting} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={handleReport} disabled={reporting} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', cursor: reporting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: reporting ? 0.7 : 1 }}>{reporting ? 'Reporting…' : 'Report'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>

  );
}

function buildSections(role, me, users, groups, t, ctx = {}) {
  const byRole = (r) => users.filter((u) => u.role === r && u.id !== me?.id);
  const { conversationPeers = [], previews = {}, unreadMap = {}, activity = {} } = ctx;
  const peerIdSet = new Set((conversationPeers || []).map((p) => String(p && p.id)));
  const hasDirectConversation = (u) => {
    const key = 'direct:' + u.id;
    const p = previews[key];
    const hasPreview = !!(p && ((p.content && String(p.content).trim()) || (Array.isArray(p.attachments) && p.attachments.length) || p.createdAt));
    return peerIdSet.has(String(u.id)) || hasPreview || (unreadMap[key] || 0) > 0 || (activity[u.id] || 0) > 0;
  };
  const sections = [];
  if (role === 'admin') {
    sections.push({ key: 'adm', title: t('role.administrators'), count: byRole('admin').length, items: byRole('admin').map(toItem('direct')) });
    sections.push({ key: 'dev', title: t('role.developers'), count: byRole('developer').length, items: byRole('developer').map(toItem('direct')) });
    sections.push({ key: 'esc', title: t('role.escalationTeam'), count: byRole('support').length, items: byRole('support').map(toItem('direct')) });
    const clientsWithConversation = byRole('client').filter(hasDirectConversation);
    sections.push({ key: 'cli', title: t('role.client') + 's', count: clientsWithConversation.length, items: clientsWithConversation.map(toItem('direct')) });
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
      email: it.email || '',
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
  return (u) => ({ type, id: u.id, name: u.name, role: u.role, email: u.email || '', avatar: u.avatar, online: u.online || u.status === 'online' || u.isOnline, members: null, last: '', time: '' });
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



