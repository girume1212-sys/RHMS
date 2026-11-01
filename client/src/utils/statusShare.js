




export function shareOfTotalPercent(count, total) {
  const countValue = Number(count) || 0;
  const totalValue = Number(total) || 0;
  if (!(totalValue > 0)) return 0;
  return Number(((countValue / totalValue) * 100).toFixed(1));
}
