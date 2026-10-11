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
 * Earliest parseable feedback date in a valid-record list (or null).
 * Used to stretch chart windows so every dated record is plotted and the
 * chart totals always equal the table totals.
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
 * Shared time buckets for trend charts. Daily = last 14 days,
 * weekly = last 12 Monday-start weeks, monthly = last 12 calendar months.
 */
function buildBuckets(period, minDate) {
  const buckets = [];
  const now = new Date();
  const push = (key, short, full, match) => buckets.push({ key, short, full, match });
  if (period === 'daily') {
    // Default last 14 days, stretched back to the earliest record so the
    // chart total always equals the table total.
    let days = 14;
    if (minDate) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const first = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      days = Math.max(14, Math.round((today - first) / 86400000) + 1);
    }
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      push(key, d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        (fd) => fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth() && fd.getDate() === d.getDate());
    }
  }
  if (period === 'weekly') {
    // weekly: last 12 ISO-ish weeks starting Monday
    const startOfWeek = (d) => {
      const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = (c.getDay() + 6) % 7; // Mon=0
      c.setDate(c.getDate() - day);
      c.setHours(0, 0, 0, 0);
      return c;
    };
    const thisMon = startOfWeek(now);
    // Default last 12 weeks, stretched back to the earliest record's week.
    let weeks = 12;
    if (minDate) {
      const firstMon = startOfWeek(minDate);
      weeks = Math.max(12, Math.round((thisMon - firstMon) / (7 * 86400000)) + 1);
    }
    const built = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const ws = new Date(thisMon); ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const key = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
      built.push({ ws, we, key,
        match: (fd) => { const t = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate()).getTime(); return t >= ws.getTime() && t <= new Date(we.getFullYear(), we.getMonth(), we.getDate()).getTime(); } });
    }
    built.forEach((b, idx) => {
      const n = idx + 1; // W1 (oldest) … Wn (current week)
      push(b.key, `W${n}`,
        `W${n}: ${b.ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${b.we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        b.match);
    });
  }
  if (period === 'monthly' || buckets.length === 0) {
    if (period !== 'monthly') buckets.length = 0;
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    // Default last 12 months, stretched back to the earliest record's month.
    let months = 12;
    if (minDate) {
      months = Math.max(12,
        (base.getFullYear() - minDate.getFullYear()) * 12 + (base.getMonth() - minDate.getMonth()) + 1);
    }
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      push(key, d.toLocaleDateString('en-US', { month: 'short' }),
        `${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getFullYear()}`,
        (fd) => fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth());
    }
  }
  return buckets;
}

/**
 * Group valid feedback into time buckets and count records per star.
 * Counts of 0 mean "no records in that bucket" (factual, not fabricated).
 * Records without a parseable created_at are excluded from the series.
 */
export function computeRatingSeries(valid, period, stretch = true) {
  const list = Array.isArray(valid) ? valid : [];
  const buckets = buildBuckets(period, stretch ? earliestDate(list) : null);
  return buckets.map(b => {
    const row = { key: b.key, period: b.short, full: b.full, total: 0 };
    STAR_SERIES.forEach(sr => { row[`star${sr.star}`] = 0; });
    list.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      if (!b.match(fd)) return;
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
export function computeSatisfactionSeries(valid, period) {
  const list = Array.isArray(valid) ? valid : [];
  return buildBuckets(period, earliestDate(list)).map(b => {
    let total = 0, sat = 0;
    list.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      if (!b.match(fd)) return;
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
export function computeSatLevelSeries(valid, period) {
  const list = Array.isArray(valid) ? valid : [];
  return buildBuckets(period, earliestDate(list)).map(b => {
    const row = { key: b.key, period: b.short, full: b.full, total: 0 };
    SAT_LEVELS.forEach(lv => { row[lv.key] = 0; });
    list.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      if (!b.match(fd)) return;
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
  // Rating Distribution: strict per-filter slices from the same valid
  // records (comments ignored, each record counted exactly once):
  // Daily = today, Weekly = today + previous 6 days, Monthly = current
  // calendar month (1st → start of tomorrow, exclusive end so midnight
  // records are included once and future-dated rows never leak in).
  const distTotals = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start;
    if (trendPeriod === 'daily') start = today;
    else if (trendPeriod === 'weekly') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    else start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    s.valid.forEach(f => {
      const raw = f.created_at ?? f.createdAt ?? f.date;
      if (!raw) return;
      const fd = new Date(raw);
      if (isNaN(fd)) return;
      const t = fd.getTime();
      if (t < start.getTime() || t >= end.getTime()) return;
      const star = Math.round(Number(f.rating));
      if (star < 1 || star > 5) return;
      counts[star] += 1;
    });
    return [5, 4, 3, 2, 1].map(star => ({
      star,
      color: (STAR_SERIES.find(sr => sr.star === star) || {}).color || '#F59E0B',
      count: counts[star]
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
  const distSub = trendPeriod === 'daily' ? 'Star totals · Today'
    : trendPeriod === 'weekly' ? 'Star totals · Last 7 days'
    : 'Star totals · This month';

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
            <div className="csat-panel csat-gradient">
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

            <div className="csat-panel csat-side csat-gradient">
              <h4>Rating Distribution</h4>
              <p className="csat-panel-sub">{distSub}</p>
              <div className="csat-dist">
                {distTotals.map(d => (
                  <div key={d.star} className="csat-dist-row"
                    title={`${d.count} × ${d.star}-Star feedback · ${distSub.replace('Star totals · ', '')}`}>
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
