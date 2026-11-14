export function formatRequestId(id) {
  if (id == null || id === '') return '';
  const raw = String(id);
  // Preserve the existing unique request number; normalize display to REQ-<number>
  const match = raw.match(/(\d+)\s*$/);
  if (match) return `REQ-${match[1]}`;
  return raw.startsWith('REQ-') ? raw : `REQ-${raw}`;
}
