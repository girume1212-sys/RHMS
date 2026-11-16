import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, FileSpreadsheet, Presentation, Download, X, ChevronRight } from 'lucide-react';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import { cleanDocumentName, documentApps, documentKind, DOCUMENT_META } from '../utils/documents';

const KIND_ICONS = {
  word: FileText,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
};

function toServerPath(filePath) {
  const value = String(filePath || '');
  if (/^https?:/i.test(value)) {
    try {
      return new URL(value).pathname;
    } catch (e) {
      return value;
    }
  }
  return value;
}

export default function OpenWithDialog({ open, filePath, fileName, requestId, messageId, onClose }) {
  const { darkMode } = useAuth();
  const dark = !!darkMode;
  const T = dark
    ? { panel: '#111C2E', surface: '#16243A', border: '#263750', text: '#E6EDF7', text2: '#9AAAC0', muted: '#71829B', accent: '#3B82F6', hover: '#1C2B45' }
    : { panel: '#FFFFFF', surface: '#EFF4FF', border: '#D7E3FF', text: '#102B65', text2: '#38558D', muted: '#6B7280', accent: '#0866F5', hover: '#EAF1FF' };

  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const dialogRef = useRef(null);

  const name = cleanDocumentName(fileName || filePath);
  const kind = documentKind(name);
  const meta = DOCUMENT_META[kind];
  const apps = documentApps(kind);
  const DocIcon = KIND_ICONS[kind] || FileText;

  useEffect(() => {
    if (!open) return;
    setBusy('');
    setNotice(null);
  }, [open, filePath, fileName]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy && onClose) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, busy, onClose]);

  const handleOpen = async (app) => {
    if (busy) return;
    setBusy(app.id);
    setNotice(null);
    try {
      await api.post('/api/attachments/open', {
        path: toServerPath(filePath),
        name,
        app: app.id,
        requestId: requestId || undefined,
        messageId: messageId || undefined,
      });
      setNotice({ tone: 'success', message: `${app.name} is opening “${name}” now. The original document was not modified.` });
      window.setTimeout(() => {
        if (onClose) onClose();
      }, 1400);
    } catch (err) {
      const message = String((err && err.message) || '');
      if (message === 'app_not_installed' || /not installed/i.test(message)) {
        setNotice({
          tone: 'warning',
          message: `${app.name} is not installed on this computer. Download the original document to open it with another application.`,
        });
      } else {
        setNotice({
          tone: 'error',
          message: message || `Could not open the document with ${app.name}. You can download the original file instead.`,
        });
      }
    } finally {
      setBusy('');
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    setNotice(null);
    try {
      const token = localStorage.getItem('rhms_token');
      const params = new URLSearchParams({ path: toServerPath(filePath), name });
      if (requestId) params.set('requestId', requestId);
      if (messageId) params.set('messageId', messageId);
      const response = await fetch(`${API_BASE}/api/attachments/download?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotice({ tone: 'success', message: `Downloading “${name}”. The original file name and format are preserved.` });
    } catch (err) {
      setNotice({ tone: 'error', message: 'Could not download the document. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  if (!open || !kind || !meta) return null;

  const toneStyles = {
    success: { background: dark ? 'rgba(34,197,94,0.12)' : '#ECFDF5', border: dark ? 'rgba(74,222,128,0.28)' : '#A7F3D0', color: dark ? '#BBF7D0' : '#166534' },
    warning: { background: dark ? 'rgba(245,158,11,0.12)' : '#FFFBEB', border: dark ? 'rgba(251,191,36,0.30)' : '#FDE68A', color: dark ? '#FDE68A' : '#92400E' },
    error: { background: dark ? 'rgba(239,68,68,0.12)' : '#FEF2F2', border: dark ? 'rgba(248,113,113,0.30)' : '#FECACA', color: dark ? '#FCA5A5' : '#991B1B' },
  };

  return createPortal(
    <div
      onClick={() => { if (!busy && onClose) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(2,6,23,0.74)' : 'rgba(15,23,42,0.46)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: 16 }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-with-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 540, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', background: T.panel, border: '1px solid ' + T.border, borderRadius: 18, boxShadow: dark ? '0 28px 80px rgba(0,0,0,0.6)' : '0 28px 80px rgba(15,23,42,0.24)', outline: 'none' }}
      >
        <div style={{ padding: '22px 22px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: meta.soft, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DocIcon size={23} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="open-with-title" style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2, color: T.text }}>Open With</div>
            <div style={{ fontSize: 12.5, color: T.text2, marginTop: 3, lineHeight: 1.45 }}>Choose an application to open this {meta.label.toLowerCase()}.</div>
          </div>
          <button
            type="button"
            onClick={() => { if (!busy && onClose) onClose(); }}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid ' + T.border, background: T.panel, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ margin: '16px 22px 0', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: dark ? 'rgba(255,255,255,0.045)' : T.surface, border: '1px solid ' + T.border }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: meta.soft, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DocIcon size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div title={name} style={{ fontSize: 13.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{meta.label}</div>
          </div>
        </div>

        <div style={{ padding: '18px 22px 0' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Choose an application</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                disabled={!!busy}
                onClick={() => handleOpen(app)}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = T.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = T.panel; }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', WebkitAppearance: 'none', opacity: busy && busy !== app.id ? 0.55 : 1 }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 11, background: app.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: app.badge === 'WPS' ? 10 : 16, letterSpacing: app.badge === 'WPS' ? 0.3 : 0, boxShadow: '0 3px 8px rgba(15,23,42,0.18)' }}>{app.badge}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: T.text }}>{app.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.35 }}>{app.hint}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 11, fontWeight: 700, color: T.accent, flexShrink: 0 }}>{busy === app.id ? 'Opening…' : 'Open'}<ChevronRight size={14} /></span>
              </button>
            ))}
            <button
              type="button"
              disabled={!!busy}
              onClick={handleDownload}
              onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = T.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.panel; }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', WebkitAppearance: 'none', opacity: busy && busy !== 'download' ? 0.55 : 1 }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 11, background: dark ? 'rgba(255,255,255,0.08)' : T.surface, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Download size={19} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: T.text }}>Download Document</span>
                <span style={{ display: 'block', fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.35 }}>Save the original file with its original name and format</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, flexShrink: 0 }}>{busy === 'download' ? 'Saving…' : 'Download'}</span>
            </button>
          </div>
        </div>

        {notice && (
          <div role="status" style={{ margin: '14px 22px 0', padding: '10px 12px', borderRadius: 10, background: toneStyles[notice.tone].background, border: '1px solid ' + toneStyles[notice.tone].border, color: toneStyles[notice.tone].color, fontSize: 12, lineHeight: 1.5 }}>
            <div>{notice.message}</div>
            {notice.tone !== 'success' && (
              <button
                type="button"
                disabled={!!busy}
                onClick={handleDownload}
                style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: 'none', background: notice.tone === 'warning' ? '#D97706' : '#DC2626', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                <Download size={14} /> Download Document
              </button>
            )}
          </div>
        )}

        <div style={{ padding: '16px 22px 20px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14, color: T.muted, fontSize: 11.5, lineHeight: 1.5 }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid ' + T.border, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>i</span>
            <span>The document opens from its original location. RHMS does not convert, copy, or modify the file.</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" disabled={!!busy} onClick={() => onClose && onClose()} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid ' + T.border, background: T.panel, color: T.text, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
