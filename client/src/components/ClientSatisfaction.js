import React, { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
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
      if (!f.created_at) return false;
      const fd = new Date(f.created_at);
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

const BAR_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#0D9488'];

export default function ClientSatisfaction({ feedback }) {
  const s = useMemo(() => computeSatisfaction(feedback), [feedback]);
  const hasData = s.total > 0;
  const hasTrend = s.months.some(m => m.score !== null);

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
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={s.months} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="csatFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.45} />
                        <stop offset="60%" stopColor="#14B8A6" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={11} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }}
                      formatter={(value, name, props) => {
                        if (name === 'score') return [value === null ? 'No data' : `${value}%`, 'Satisfaction'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.label || label}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="score" name="Satisfaction %"
                      stroke="#14B8A6" strokeWidth={2.5} fill="url(#csatFill)"
                      dot={{ r: 3.5, fill: '#14B8A6', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="csat-panel">
              <h4>Ratings Distribution</h4>
              <p className="csat-panel-sub">Feedback records per star (1–5)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={s.dist} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="star" fontSize={12} tickLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} label={{ value: 'Responses', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }} formatter={(value) => [value, 'Responses']} labelFormatter={(l) => `${l} rating`} cursor={{ fill: '#f8fafc' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Responses" radius={[6, 6, 0, 0]}>
                    {s.dist.map(d => <Cell key={d.rating} fill={BAR_COLORS[d.rating - 1]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
