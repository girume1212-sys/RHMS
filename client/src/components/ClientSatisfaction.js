import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

/**
 * Client Satisfaction analytics — computed ONLY from real feedback records.
 *
 * Formulas (documented):
 * - Valid record = rating is an integer/float in [1, 5].
 * - Satisfaction Score (%) = (count(rating >= 4) / count(valid)) * 100, rounded to 1 decimal.
 * - Average Client Rating = sum(valid ratings) / count(valid), rounded to 1 decimal.
 * - Total Feedback Responses = count(valid).
 * - Feedback With Comments = count(valid AND comment non-empty after trim).
 * - Monthly trend: group valid records by submission month (created_at, YYYY-MM),
 *   monthly score uses the same satisfaction formula per month. Last 12 months are
 *   shown; months with zero records have score null (gap, not zero) so no values
 *   are fabricated.
 * - Star distribution: exact DB counts per rating 1..5.
 */
export function computeSatisfaction(feedback) {
  const valid = (Array.isArray(feedback) ? feedback : []).filter(f => {
    const r = Number(f?.rating);
    return Number.isFinite(r) && r >= 1 && r <= 5;
  });
  const total = valid.length;
  const satisfied = valid.filter(f => Number(f.rating) >= 4).length;
  const score = total > 0 ? Math.round((satisfied / total) * 1000) / 10 : null;
  const avg = total > 0
    ? Math.round((valid.reduce((s, f) => s + Number(f.rating), 0) / total) * 10) / 10
    : null;
  const withComments = valid.filter(f => f.comment && String(f.comment).trim().length > 0).length;
  const dist = [1, 2, 3, 4, 5].map(star => ({
    star: `${star} ★`,
    rating: star,
    count: valid.filter(f => Math.round(Number(f.rating)) === star).length
  }));
  // Monthly trend — last 12 calendar months
  const months = [];
  const now = new Date();
  now.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const inMonth = valid.filter(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return false;
      const fd = new Date(raw);
      if (isNaN(fd)) return false;
      return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth();
    });
    const mTotal = inMonth.length;
    const mSat = inMonth.filter(f => Number(f.rating) >= 4).length;
    months.push({
      key,
      month: mTotal > 0 && months.length > 0 ? label : label,
      label: `${label} ${d.getFullYear()}`,
      responses: mTotal,
      score: mTotal > 0 ? Math.round((mSat / mTotal) * 1000) / 10 : null
    });
  }
  return { valid, total, satisfied, score, avg, withComments, dist, months };
}

// Star series colors for the distribution-over-time chart (1..5 stars).
const STAR_SERIES = [
  { star: 1, name: '1 Star', color: '#EF4444' },
  { star: 2, name: '2 Stars', color: '#F97316' },
  { star: 3, name: '3 Stars', color: '#F59E0B' },
  { star: 4, name: '4 Stars', color: '#10B981' },
  { star: 5, name: '5 Stars', color: '#0D9488' }
];

// Satisfaction bands — same thresholds as the Feedback table badges
// (verySatisfied ≥ 4.5, satisfied ≥ 3.5, neutral ≥ 2.5, dissatisfied ≥ 1.5).
const SAT_LEVELS = [
  { key: 'verySatisfied', name: 'Very Satisfied', color: '#059669' },
  { key: 'satisfied', name: 'Satisfied', color: '#10B981' },
  { key: 'neutral', name: 'Neutral', color: '#F59E0B' },
  { key: 'dissatisfied', name: 'Dissatisfied', color: '#F97316' },
  { key: 'veryDissatisfied', name: 'Very Dissatisfied', color: '#DC2626' }
];

export function satLevelKey(rating) {
  const num = Number(rating) || 0;
  if (num >= 4.5) return 'verySatisfied';
  if (num >= 3.5) return 'satisfied';
  if (num >= 2.5) return 'neutral';
  if (num >= 1.5) return 'dissatisfied';
  return 'veryDissatisfied';
}

/**
 * Shared time buckets for trend charts. Daily = last 14 days,
 * weekly = last 12 Monday-start weeks (labeled W1–W12), monthly = last 12
 * calendar months. Full date-range labels are kept for tooltips.
 */
/**
 * Timezone handling — one consistent zone (the app's configured `timeZone`
 * setting, default Africa/Addis_Ababa) for "today", bucket boundaries and
 * labels. All bucket matches are half-open UTC intervals [start, end), so
 * midnight records are never missed or double-counted, and future-dated
 * records never leak into the current bucket.
 */
export const DEFAULT_TZ = 'Africa/Addis_Ababa';

function tzOffsetMinutes(tz, utcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  dtf.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; });
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - utcMs) / 60000);
}

// UTC instant of wall-clock midnight for a zoned calendar date.
function zonedMidnightUTC(tz, y, m, d) {
  let guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let k = 0; k < 3; k++) guess = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMinutes(tz, guess) * 60000;
  return guess;
}

function zonedTodayParts(tz, atMs) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(atMs)).forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day };
}

function shiftYMD(y, m, d, n) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function fmtDay(utcMs, tz) {
  return new Date(utcMs).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });
}
function fmtDayYear(utcMs, tz) {
  return new Date(utcMs).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMonthYear(y, m) {
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Earliest parseable feedback date in a valid-record list (or null).
 * Used to stretch the weekly window so every dated record is plotted.
 */
function earliestDate(list) {
  let min = null;
  list.forEach(f => {
    const raw = f.created_at ?? f.createdAt ?? f.date;
    if (!raw) return;
    const fd = new Date(raw);
    if (isNaN(fd)) return;
    if (min === null || fd < min) min = fd;
  });
  return min;
}

/**
 * Shared time buckets. `match` takes a UTC-ms instant and tests the
 * half-open interval [start, end):
 * - daily: today only, [today 00:00, tomorrow 00:00) in the app timezone.
 * - last14: today + previous 13 days (exactly 14 dates, both ends covered).
 * - weekly: Monday-start weeks, default last 12, stretched to earliest record.
 * - monthly: previous calendar month + current month (current runs from the
 *   1st through the start of tomorrow — never future dates).
 */
function buildBuckets(period, minDate, tz) {
  const zone = tz || DEFAULT_TZ;
  const buckets = [];
  const nowMs = Date.now();
  const t = zonedTodayParts(zone, nowMs);
  const todayStart = zonedMidnightUTC(zone, t.y, t.m, t.d);
  const td = shiftYMD(t.y, t.m, t.d, 1);
  const tomorrowStart = zonedMidnightUTC(zone, td.y, td.m, td.d);
  const push = (key, short, full, start, end) => buckets.push({
    key, short, full, start, end, match: (ms) => ms >= start && ms < end
  });
  if (period === 'daily') {
    push(`day-${t.y}-${t.m}-${t.d}`, 'Today', `Today · ${fmtDayYear(todayStart, zone)}`, todayStart, tomorrowStart);
  }
  if (period === 'last14') {
    for (let i = 13; i >= 0; i--) {
      const dd = shiftYMD(t.y, t.m, t.d, -i);
      const start = zonedMidnightUTC(zone, dd.y, dd.m, dd.d);
      const nx = shiftYMD(dd.y, dd.m, dd.d, 1);
      const end = zonedMidnightUTC(zone, nx.y, nx.m, nx.d);
      push(`day-${dd.y}-${dd.m}-${dd.d}`, fmtDay(start, zone), fmtDayYear(start, zone), start, end);
    }
  }
  if (period === 'weekly') {
    // Monday-start weeks in wall-clock terms (Mon=0 … Sun=6).
    const wallDow = (new Date(todayStart).toLocaleDateString('en-US', { timeZone: zone, weekday: 'short' }));
    const dowIdx = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[wallDow] ?? 0;
    const mon = shiftYMD(t.y, t.m, t.d, -dowIdx);
    let thisMonStart = zonedMidnightUTC(zone, mon.y, mon.m, mon.d);
    let weeks = 12;
    if (minDate) {
      const fp = zonedTodayParts(zone, minDate.getTime());
      const fdn = new Date(zonedMidnightUTC(zone, fp.y, fp.m, fp.d))
        .toLocaleDateString('en-US', { timeZone: zone, weekday: 'short' });
      const fIdx = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[fdn] ?? 0;
      const fmon = shiftYMD(fp.y, fp.m, fp.d, -fIdx);
      const firstMonStart = zonedMidnightUTC(zone, fmon.y, fmon.m, fmon.d);
      weeks = Math.max(12, Math.round((thisMonStart - firstMonStart) / (7 * 86400000)) + 1);
    }
    const built = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const wsUtc = thisMonStart - i * 7 * 86400000;
      // Week end = next Monday 00:00 wall time (DST-safe); weekly grid is
      // Monday-anchored so fixed 7-day steps stay aligned.
      const wp = zonedTodayParts(zone, wsUtc + 12 * 3600000);
      const nx = shiftYMD(wp.y, wp.m, wp.d, 7);
      const weUtc = zonedMidnightUTC(zone, nx.y, nx.m, nx.d);
      built.push({ wsUtc, weUtc });
    }
    built.forEach((b, idx) => {
      const n = idx + 1; // W1 (oldest) … Wn (current week)
      const key = `w-${n}-${b.wsUtc}`;
      push(key, `W${n}`, `W${n}: ${fmtDay(b.wsUtc, zone)} – ${fmtDayYear(b.weUtc - 1, zone)}`, b.wsUtc, b.weUtc);
    });
  }
  if (period === 'monthly' || buckets.length === 0) {
    if (period !== 'monthly') buckets.length = 0;
    const prev = t.m === 1 ? { y: t.y - 1, m: 12 } : { y: t.y, m: t.m - 1 };
    const prevStart = zonedMidnightUTC(zone, prev.y, prev.m, 1);
    const curStart = zonedMidnightUTC(zone, t.y, t.m, 1);
    push(`mo-${prev.y}-${prev.m}`, new Date(Date.UTC(prev.y, prev.m - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      fmtMonthYear(prev.y, prev.m), prevStart, curStart);
    push(`mo-${t.y}-${t.m}`, new Date(Date.UTC(t.y, t.m - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      fmtMonthYear(t.y, t.m), curStart, tomorrowStart);
  }
  return buckets;
}

/**
 * Group valid feedback into time buckets and count records per star.
 * Counts of 0 mean "no records in that bucket" (factual, not fabricated).
 * Records without a parseable created_at are excluded from the series.
 */
export function computeRatingSeries(valid, period, stretch = true, tz) {
  const list = Array.isArray(valid) ? valid : [];
  const buckets = buildBuckets(period, stretch ? earliestDate(list) : null, tz);
  return buckets.map(b => {
    const row = { key: b.key, period: b.short, full: b.full, total: 0 };
    STAR_SERIES.forEach(sr => { row[`star${sr.star}`] = 0; });
    list.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      if (!b.match(fd.getTime())) return;
      const star = Math.round(Number(f.rating));
      if (star < 1 || star > 5) return;
      row[`star${star}`] += 1;
      row.total += 1;
    });
    return row;
  });
}

/**
 * Satisfaction % per time bucket using the same formula as the monthly
 * trend (rating >= 4 / valid in bucket). Empty buckets keep score null
 * (gap, never a fake zero). Records without a parseable date are excluded.
 */
export function computeSatisfactionSeries(valid, period, tz) {
  const list = Array.isArray(valid) ? valid : [];
  return buildBuckets(period, earliestDate(list), tz).map(b => {
    let total = 0, sat = 0;
    list.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      if (!b.match(fd.getTime())) return;
      total += 1;
      if (Number(f.rating) >= 4) sat += 1;
    });
    return {
      key: b.key,
      period: b.short,
      month: b.short,
      label: b.full,
      full: b.full,
      responses: total,
      satisfied: sat,
      score: total > 0 ? Math.round((sat / total) * 1000) / 10 : null
    };
  });
}

/**
 * Records per satisfaction band per time bucket (factual counts, 0 = no
 * records in that bucket). Band assignment reuses the Feedback table
 * thresholds via satLevelKey — no new logic.
 */
export function computeSatLevelSeries(valid, period, tz) {
  const list = Array.isArray(valid) ? valid : [];
  return buildBuckets(period, earliestDate(list), tz).map(b => {
    const row = { key: b.key, period: b.short, full: b.full, total: 0 };
    SAT_LEVELS.forEach(lv => { row[lv.key] = 0; });
    list.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      if (!b.match(fd.getTime())) return;
      if (!b.match(fd)) return;
      row[satLevelKey(f.rating)] += 1;
      row.total += 1;
    });
    return row;
  });
}

// Tooltip for the distribution / satisfaction-level charts: period, per-series counts.
function DistTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const full = payload[0]?.payload?.full || label;
  const rows = payload.filter(p => p && p.value !== undefined);
  return (
    <div className="csat-tip">
      <div className="csat-tip-title">{full}</div>
      {rows.map(p => (
        <div className="csat-tip-row" key={p.dataKey}>
          <span className="csat-tip-dot" style={{ background: p.color || p.stroke }} />
          <span>{p.name}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function ClientSatisfaction({ feedback }) {
  const s = useMemo(() => computeSatisfaction(feedback), [feedback]);
  const [trendPeriod, setTrendPeriod] = useState('weekly');
  const trendLevels = useMemo(() => computeSatLevelSeries(s.valid, trendPeriod), [s.valid, trendPeriod]);
  // Star totals for the selected period slice (fixed windows — last 14
  // days / 12 weeks / 12 months — so the card changes with the toggle).
  const distTotals = useMemo(() => {
    const series = computeRatingSeries(s.valid, trendPeriod, false);
    return [5, 4, 3, 2, 1].map(star => ({
      star,
      color: (STAR_SERIES.find(sr => sr.star === star) || {}).color || '#F59E0B',
      count: series.reduce((sum, r) => sum + (Number(r[`star${star}`]) || 0), 0)
    }));
  }, [s.valid, trendPeriod]);
  const distMax = Math.max(...distTotals.map(d => d.count), 1);
  // Y-axis: whole numbers scaled to the actual record counts —
  // e.g. 0–7 when the peak weekly count is 7. The ceiling and ticks grow
  // automatically as feedback volume increases.
  const trendPeak = useMemo(() => {
    let peak = 0;
    trendLevels.forEach(r => {
      SAT_LEVELS.forEach(lv => {
        const v = Number(r[lv.key]) || 0;
        if (v > peak) peak = v;
      });
    });
    return peak;
  }, [trendLevels]);
  const { yMax, yTicks } = useMemo(() => {
    if (trendPeak <= 10) {
      const max = Math.max(trendPeak, 1);
      const ticks = [];
      for (let v = 0; v <= max; v += 1) ticks.push(v);
      return { yMax: max, yTicks: ticks };
    }
    // Nice step (1/2/5 × 10^n) aiming for ~8-10 ticks.
    const raw = trendPeak / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const step = nice * mag;
    const max = Math.ceil(trendPeak / step) * step;
    const ticks = [];
    for (let v = 0; v <= max; v += step) ticks.push(Math.round(v));
    return { yMax: max, yTicks: ticks };
  }, [trendPeak]);
  const hasData = s.total > 0;
  const hasTrend = trendLevels.some(m => (m.total || 0) > 0);
  const nBuckets = trendLevels.length;
  const trendSub = trendPeriod === 'daily' ? `Feedback records per satisfaction level · Last ${nBuckets} days`
    : trendPeriod === 'weekly' ? `Feedback records per satisfaction level · Last ${nBuckets} weeks`
    : `Feedback records per satisfaction level · Last ${nBuckets} months`;
  const distSub = trendPeriod === 'daily' ? 'Star totals · Last 14 days'
    : trendPeriod === 'weekly' ? 'Star totals · Last 12 weeks'
    : 'Star totals · Last 12 months';

  const cards = [
    { label: 'Satisfaction Score', value: hasData ? `${s.score}%` : '—', sub: hasData ? `${s.satisfied} of ${s.total} rated 4+` : 'No data', color: '#0D9488' },
    { label: 'Total Feedback Responses', value: hasData ? s.total : '—', sub: 'Real database records', color: '#3B82F6' },
    { label: 'Average Client Rating', value: hasData ? `${s.avg} / 5` : '—', sub: hasData ? 'Mean of all ratings' : 'No data', color: '#F59E0B' },
    { label: 'Feedback With Comments', value: hasData ? s.withComments : '—', sub: hasData ? `${Math.round((s.withComments / s.total) * 1000) / 10}% include text` : 'No data', color: '#8B5CF6' }
  ];

  return (
    <div className="chart-card" style={{ marginTop: '24px' }}>
      <div className="table-header-bar" style={{ marginBottom: '4px' }}>
        <div>
          <h3>Client Satisfaction</h3>
          <p className="chart-subtitle" style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
            Score = % of responses rated 4 or higher · calculated from live feedback records
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="chart-empty csat-empty">
          No valid feedback yet — statistics and charts will appear once clients submit ratings.
        </div>
      ) : (
        <>
          <div className="csat-cards">
            {cards.map(c => (
              <div key={c.label} className="csat-card" style={{ '--csat-accent': c.color }}>
                <div className="csat-card-bar" />
                <div className="csat-card-label">{c.label}</div>
                <div className="csat-card-value">{c.value}</div>
                <div className="csat-card-sub">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="csat-charts">
            <div className="csat-panel">
              <div className="csat-panel-head">
                <div>
                  <h4>Satisfaction Trend</h4>
                  <p className="csat-panel-sub">{trendSub}</p>
                </div>
                <div className="csat-period-toggle" role="tablist" aria-label="Trend period">
                  {[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([key, lbl]) => (
                    <button key={key} type="button" role="tab" aria-selected={trendPeriod === key}
                      className={`csat-period-btn${trendPeriod === key ? ' active' : ''}`}
                      onClick={() => setTrendPeriod(key)}>{lbl}</button>
                  ))}
                </div>
              </div>
              {!hasTrend ? (
                <div className="csat-panel-empty">Not enough dated records to draw a trend.</div>
              ) : (
                <div className="csat-chart-wrap">
                  <span className="csat-y-title">Feedback Records</span>
                <ResponsiveContainer width="100%" height={420}>
                  <AreaChart data={trendLevels} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <defs>
                      {SAT_LEVELS.map(lv => (
                        <linearGradient key={lv.key} id={`csatLvl-${lv.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={lv.color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={lv.color} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" fontSize={11} tickLine={false}
                      interval={trendPeriod === 'weekly' ? 0 : 'preserveStartEnd'}
                      angle={trendPeriod === 'weekly' ? 0 : -20} textAnchor={trendPeriod === 'weekly' ? 'middle' : 'end'}
                      height={trendPeriod === 'weekly' ? 30 : 50} />
                    <YAxis domain={[0, yMax]} ticks={yTicks} allowDecimals={false} fontSize={11} tickLine={false} width={40} />
                    <Tooltip content={<DistTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {SAT_LEVELS.map(lv => (
                      <Area key={lv.key} type="monotone" dataKey={lv.key} name={lv.name}
                        stroke={lv.color} strokeWidth={2.5} fill={`url(#csatLvl-${lv.key})`}
                        dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="csat-panel csat-side">
              <h4>Rating Distribution</h4>
              <p className="csat-panel-sub">{distSub}</p>
              <div className="csat-dist">
                {distTotals.map(d => (
                  <div key={d.star} className="csat-dist-row">
                    <span className="csat-dist-star">{d.star}</span>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill={d.color} aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <div className="csat-dist-track">
                      <div className="csat-dist-fill" style={{ width: `${(d.count / distMax) * 100}%`, background: d.color }} />
                    </div>
                    <span className="csat-dist-count">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
