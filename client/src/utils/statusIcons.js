const STATUS_ICON_MAP = {
  new: 'new',
  assigned: 'assigned',
  'in progress': 'inProgress',
  'waiting for client': 'waiting',
  resolved: 'resolved',
  closed: 'closed',
  rejected: 'rejected',
  escalated: 'escalated',
  reopened: 'refresh',
  pending: 'clock',
  'on hold': 'lock',
  cancelled: 'x',
  'under review': 'eye',
  approved: 'check',
  completed: 'check',
  failed: 'x',
  active: 'zap',
  inactive: 'lock',
  default: 'clipboard'
};

export function getStatusIcon(name) {
  if (!name) return 'clipboard';
  const key = name.toLowerCase().trim();
  if (STATUS_ICON_MAP[key]) return STATUS_ICON_MAP[key];
  if (key.includes('new')) return 'new';
  if (key.includes('assign')) return 'assigned';
  if (key.includes('progress') || key.includes('working')) return 'inProgress';
  if (key.includes('wait') || key.includes('pending') || key.includes('hold')) return 'waiting';
  if (key.includes('resolv') || key.includes('complet') || key.includes('done') || key.includes('finish')) return 'resolved';
  if (key.includes('close') || key.includes('archive')) return 'closed';
  if (key.includes('reject') || key.includes('cancel') || key.includes('fail')) return 'rejected';
  if (key.includes('escalat') || key.includes('urgent') || key.includes('critical')) return 'escalated';
  if (key.includes('review') || key.includes('approv')) return 'eye';
  if (key.includes('active') || key.includes('live')) return 'zap';
  if (key.includes('lock') || key.includes('block') || key.includes('inactive')) return 'lock';
  return 'clipboard';
}
