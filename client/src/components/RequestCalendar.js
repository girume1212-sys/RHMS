import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const startOfWeek = (d) => addDays(d, -d.getDay());

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export default function RequestCalendar() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  const DAY_LABELS = DAY_KEYS.map((k) => t('days.' + k));

  const today = useMemo(() => startOfDay(new Date()), []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/requests');
      setRequests(data || []);
    } catch (err) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadRequests();
  };

  const openRequest = (id) => {
    setOpen(false);
    const base = user?.role === 'client' ? '/client/requests' : '/requests';
    navigate(`/${base}/${id}`);
  };

  const byDay = useMemo(() => {
    const map = {};
    const add = (r, type) => {
      if (type === 'created' && r.createdAt) {
        const k = toKey(startOfDay(new Date(r.createdAt)));
        (map[k] = map[k] || { created: [], updated: [] }).created.push(r);
      }
      if (type === 'updated' && r.updatedAt) {
        const k = toKey(startOfDay(new Date(r.updatedAt)));
        const ck = r.createdAt ? toKey(startOfDay(new Date(r.createdAt))) : null;
        if (k !== ck) (map[k] = map[k] || { created: [], updated: [] }).updated.push(r);
      }
    };
    requests.forEach((r) => { add(r, 'created'); add(r, 'updated'); });
    return map;
  }, [requests]);

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const weekCells = useMemo(() => {
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [cursor]);

  const shift = (dir) => {
    setCursor((c) => {
      if (view === 'month') return addMonths(c, dir);
      if (view === 'week') return addDays(c, dir * 7);
      return addDays(c, dir);
    });
  };

  const goToday = () => setCursor(startOfDay(new Date()));

  const monthName = (d) => t('months.' + MONTH_KEYS[d.getMonth()]);
  const dayName = (d) => t('days.' + DAY_KEYS[d.getDay()]);

  const rangeLabel = () => {
    if (view === 'month') return `${monthName(cursor)} ${cursor.getFullYear()}`;
    if (view === 'week') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      const sL = `${monthName(s)} ${s.getDate()}`;
      const eL = s.getFullYear() === e.getFullYear()
        ? `${monthName(e)} ${e.getDate()}`
        : `${monthName(e)} ${e.getDate()}, ${e.getFullYear()}`;
      return `${sL} – ${eL}`;
    }
    return `${monthName(cursor)} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  };

  const viewLabel = () => {
    if (view === 'month') return `${monthName(cursor)} ${cursor.getFullYear()}`;
    if (view === 'week') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${monthName(s)} ${s.getDate()} – ${monthName(e)} ${e.getDate()}, ${e.getFullYear()}`;
    }
    return `${dayName(cursor)} ${monthName(cursor)} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  };

  const chip = (r, type, showSubject) => (
    <span
      key={`${r.id}-${type}`}
      className={`req-cal-chip req-cal-chip-${type}`}
      title={`#${r.id} ${r.subject}` + (type === 'updated' ? ' (' + t('calendar.updated') + ')' : '')}
      onClick={(e) => { e.stopPropagation(); openRequest(r.id); }}
    >
      <span className="req-cal-chip-dot"></span>
      {showSubject ? `#${r.id} · ${r.subject}` : `#${r.id}`}
    </span>
  );

  const bucketChips = (bucket, showSubject, limit = 3) => {
    if (!bucket) return null;
    const created = bucket.created || [];
    const updated = bucket.updated || [];
    const total = created.length + updated.length;
    const items = [];
    created.slice(0, limit).forEach((r) => items.push(chip(r, 'created', showSubject)));
    updated.slice(0, Math.max(0, limit - items.length)).forEach((r) => items.push(chip(r, 'updated', showSubject)));
    const extra = total - items.length;
    return (
      <>
        {items}
        {extra > 0 && <span className="req-cal-more">+{extra}</span>}
      </>
    );
  };

  const dayRequests = (d) => {
    const bucket = byDay[toKey(d)];
    return {
      created: bucket?.created || [],
      updated: bucket?.updated || [],
    };
  };

  const renderMonth = () => (
    <div className="req-cal-grid">
      {DAY_LABELS.map((d) => <div key={d} className="req-cal-weekday">{d}</div>)}
      {monthCells.map((d) => {
        const inMonth = d.getMonth() === cursor.getMonth();
        const isToday = toKey(d) === toKey(today);
        const bucket = byDay[toKey(d)];
        return (
          <div
            key={toKey(d)}
            className={`req-cal-cell${inMonth ? '' : ' out'}` + (isToday ? ' today' : '')}
            onClick={() => setCursor(d)}
          >
            <span className="req-cal-daynum">{d.getDate()}</span>
            {bucketChips(bucket, false)}
          </div>
        );
      })}
    </div>
  );

  const renderWeek = () => (
    <div className="req-cal-week">
      {weekCells.map((d) => {
        const isToday = toKey(d) === toKey(today);
        const bucket = byDay[toKey(d)];
        return (
          <div key={toKey(d)} className={`req-cal-week-col${isToday ? ' today' : ''}`} onClick={() => setCursor(d)}>
            <div className="req-cal-week-head">
              <span className="req-cal-weekday">{DAY_LABELS[d.getDay()]}</span>
              <span className="req-cal-daynum">{d.getDate()}</span>
            </div>
            <div className="req-cal-week-list">
              {bucketChips(bucket, true, 4)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDay = () => {
    const { created, updated } = dayRequests(cursor);
    const all = [...created.map((r) => ({ r, type: 'created' })), ...updated.map((r) => ({ r, type: 'updated' }))];
    return (
      <div className="req-cal-day">
        <div className="req-cal-day-date">
          {cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {toKey(cursor) === toKey(today) && <span className="req-cal-today-badge">{t('common.today')}</span>}
        </div>
        {all.length === 0 && <div className="req-cal-empty">{t('calendar.noRequestsDay')}</div>}
        {all.map(({ r, type }) => (
          <div key={`${r.id}-${type}`} className="req-cal-day-item" onClick={() => openRequest(r.id)}>
            <span className={`req-cal-chip req-cal-chip-${type}`}>
              <span className="req-cal-chip-dot"></span>
              #{r.id} {type === 'updated' ? `(${t('calendar.updated')})` : ''}
            </span>
            <div className="req-cal-day-item-body">
              <div className="req-cal-day-item-title">{r.subject}</div>
              <div className="req-cal-day-item-meta">
                <span className="status-badge" style={{ background: (r.status?.color || '#6B7280') + '20', color: r.status?.color || '#6B7280' }}>{r.status?.name || '—'}</span>
                <span className="priority-badge" style={{ background: (r.priority?.color || '#6B7280') + '20', color: r.priority?.color || '#6B7280' }}>{transSeeded(r.priority?.name, 'priority', t) || '—'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="req-calendar" ref={rootRef}>
      <button className="calendar-icon-btn" title={t('calendar.calendar')} onClick={toggle}>
        <span className="req-cal-btn-icon">📅</span>
        <span className="req-cal-btn-label">{rangeLabel()}</span>
        <span className="req-cal-btn-arrow">▾</span>
      </button>
      {open && (
        <div className="req-calendar-panel">
          <div className="req-calendar-top">
            <div className="req-calendar-title">{viewLabel()}</div>
            <button className="req-cal-today-btn" onClick={goToday}>{t('common.today')}</button>
          </div>
          <div className="req-calendar-toolbar">
            <button className="req-cal-nav-btn" onClick={() => shift(-1)} title={t('calendar.previous')}>‹</button>
            <div className="req-cal-view-switch">
              {['month', 'week', 'day'].map((v) => (
                <button key={v} className={`req-cal-view-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
                  {t('calendar.' + v)}
                </button>
              ))}
            </div>
            <button className="req-cal-nav-btn" onClick={() => shift(1)} title={t('calendar.next')}>›</button>
          </div>

          <div className="req-calendar-body">
            {loading ? (
              <div className="req-cal-loading"><div className="spinner"></div></div>
            ) : (
              <>
                {view === 'month' && renderMonth()}
                {view === 'week' && renderWeek()}
                {view === 'day' && renderDay()}
              </>
            )}
          </div>

          <div className="req-calendar-legend">
            <span className="req-cal-legend-item"><span className="req-cal-legend-dot created"></span>{t('calendar.created')}</span>
            <span className="req-cal-legend-item"><span className="req-cal-legend-dot updated"></span>{t('calendar.updated')}</span>
            <span className="req-cal-legend-item"><span className="req-cal-legend-dot today"></span>{t('common.today')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
