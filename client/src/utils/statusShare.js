// Share of the visible request total for a single status card.
//
// The value is always derived from the counts the dashboard already has, so it
// stays consistent with the big number on the card and updates as soon as the
// underlying requests change.
export function shareOfTotalPercent(count, total) {
  const countValue = Number(count) || 0;
  const totalValue = Number(total) || 0;
  if (!(totalValue > 0)) return 0;
  return Number(((countValue / totalValue) * 100).toFixed(1));
}
