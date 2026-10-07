// Critical red animated dot — visible ONLY when:
//   priority === 'Critical' AND status === 'New' OR 'Assigned'.
// Priority + Status drive the decision (NOT claimed/assignee alone).
// Accepts both object ({ name }) and plain-string shapes used across RHMS.
export function getPriorityName(priority) {
  if (!priority) return '';
  return typeof priority === 'string' ? priority : (priority.name || '');
}

export function getStatusName(status) {
  if (!status) return '';
  return typeof status === 'string' ? status : (status.name || '');
}

export function isCriticalUnworked(request) {
  if (!request) return false;
  const priority = getPriorityName(request.priority ?? request.priorityName);
  const status = getStatusName(request.status ?? request.statusName);
  return priority === 'Critical' && (status === 'New' || status === 'Assigned');
}

export default isCriticalUnworked;
