// Real week-over-week helpers shared by every dashboard stat card.
//
// The window is the 7 days immediately preceding the last 7 days, and both
// counts are always derived from database rows, never generated client-side.

export function getLastWeekWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Returns a signed percentage rounded to one decimal. With no previous-week
// baseline there is no real percentage to report, so 0 is returned instead of
// an invented jump.
export function weekOverWeekPercent(current, previous) {
  const currentCount = Number(current) || 0;
  const previousCount = Number(previous) || 0;
  if (previousCount <= 0) return 0;
  return Number((((currentCount - previousCount) / previousCount) * 100).toFixed(1));
}
