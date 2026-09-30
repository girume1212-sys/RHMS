// Real week-over-week helpers shared by every dashboard stat card.
//
// The dashboard cards compare the current 7-day window against the 7 days
// before it, and both sides always come from stored request history, so the
// figures update as soon as new data is written.

export function getLastWeekWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Returns a signed percentage rounded to one decimal. A previous-week baseline
// of zero has no meaningful percentage, so 0 is returned instead of an
// invented jump.
export function weekOverWeekPercent(current, previous) {
  const currentCount = Number(current) || 0;
  const previousCount = Number(previous) || 0;
  if (!(previousCount > 0)) return 0;
  return Number((((currentCount - previousCount) / previousCount) * 100).toFixed(1));
}
