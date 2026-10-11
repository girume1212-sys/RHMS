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

/**
 * Group valid feedback into time buckets and count records per star.
 * Counts of 0 mean "no records in that bucket" (factual, not fabricated).
 * Records without a parseable created_at are excluded from the series.
 */
/**
 * Shared time buckets for trend charts. Daily = last 14 days,
 * weekly = last 12 Monday-start weeks, monthly = last 12 calendar months.
 */
function buildBuckets(period) {
  const buckets = [];
  const now = new Date();
  const push = (key, short, full, match) => buckets.push({ key, short, full, match });
  if (period === 'daily') {
    for (let i = 13; i >= 0; i--) {
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
    for (let i = 11; i >= 0; i--) {
      const ws = new Date(thisMon); ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const key = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`;
      push(key, ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        (fd) => { const t = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate()).getTime(); return t >= ws.getTime() && t <= new Date(we.getFullYear(), we.getMonth(), we.getDate()).getTime(); });
    }
  }
  if (period === 'monthly' || buckets.length === 0) {
    if (period !== 'monthly') buckets.length = 0;
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 11; i >= 0; i--) {
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
export function computeRatingSeries(valid, period) {
  const list = Array.isArray(valid) ? valid : [];
  const buckets = buildBuckets(period);
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
  return buildBuckets(period).map(b => {
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

// Tooltip for the satisfaction trend: month, % (or "No feedback"), record count.
function TrendTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="csat-tip">
      <div className="csat-tip-title">{row.full || row.label || row.month}</div>
      <div className="csat-tip-row">
        <span className="csat-tip-dot" style={{ background: '#2DD4BF' }} />
        <span>Satisfaction</span>
        <strong>{row.score === null || row.score === undefined ? 'No feedback' : `${row.score}%`}</strong>
      </div>
      <div className="csat-tip-row csat-tip-muted">
        <span>Feedback records</span>
        <strong>{row.responses ?? 0}</strong>
      </div>
    </div>
  );
}

// Tooltip for the distribution chart: period, per-star counts.
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
  const [distPeriod, setDistPeriod] = useState('monthly');
  const distSeries = useMemo(() => computeRatingSeries(s.valid, distPeriod), [s.valid, distPeriod]);
  const hasData = s.total > 0;
  const hasTrend = s.months.some(m => m.score !== null);
  const hasDistTrend = distSeries.some(r => (r.total || 0) > 0);

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
              <h4>Satisfaction Trend (Monthly)</h4>
              <p className="csat-panel-sub">% satisfied per month · last 12 months</p>
              {!hasTrend ? (
                <div className="csat-panel-empty">Not enough dated records to draw a trend.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={s.months} margin={{ top: 8, right: 12, left: -8, bottom: 20 }}>
                    <defs>
                      <linearGradient id="csatAbstract" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.45} />
                        <stop offset="60%" stopColor="#2DD4BF" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={11} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} tickLine={false} />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="score" name="Satisfaction %"
                      stroke="#2DD4BF" strokeWidth={3} fill="url(#csatAbstract)"
                      dot={{ r: 3.5, fill: '#2DD4BF', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: '#2DD4BF', stroke: '#fff', strokeWidth: 2 }}
                      connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="csat-panel">
              <div className="csat-panel-head">
                <div>
                  <h4>Ratings Distribution</h4>
                  <p className="csat-panel-sub">Feedback records per star (1–5) over time</p>
                </div>
                <div className="csat-period-toggle" role="tablist" aria-label="Distribution period">
                  {[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([key, lbl]) => (
                    <button key={key} type="button" role="tab" aria-selected={distPeriod === key}
                      className={`csat-period-btn${distPeriod === key ? ' active' : ''}`}
                      onClick={() => setDistPeriod(key)}>{lbl}</button>
                  ))}
                </div>
              </div>
              {!hasDistTrend ? (
                <div className="csat-panel-empty">Not enough dated records to draw a trend.</div>
              ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={distSeries} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    {STAR_SERIES.map(sr => (
                      <linearGradient key={sr.star} id={`csatStar${sr.star}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sr.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={sr.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" fontSize={11} tickLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                  <Tooltip content={<DistTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {STAR_SERIES.map(sr => (
                    <Area key={sr.star} type="monotone" dataKey={`star${sr.star}`} name={sr.name}
                      stroke={sr.color} strokeWidth={2.5} fill={`url(#csatStar${sr.star})`}
                      dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
