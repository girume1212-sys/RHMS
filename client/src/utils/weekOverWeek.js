





export function getLastWeekWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { start: start.toISOString(), end: end.toISOString() };
}




export function weekOverWeekPercent(current, previous) {
  const currentCount = Number(current) || 0;
  const previousCount = Number(previous) || 0;
  if (!(previousCount > 0)) return 0;
  return Number((((currentCount - previousCount) / previousCount) * 100).toFixed(1));
}
