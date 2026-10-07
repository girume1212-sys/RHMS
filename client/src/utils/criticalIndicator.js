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

// User-specific: is this Critical New/Assigned request actionable for the
// logged-in user? Mirrors the existing read-only rule (a request assigned to
// someone else is read-only) so the bell count only includes requests the
// user is responsible for:
//   - admin: everything visible counts (never read-only).
//   - client: own visible requests count (clients only see their own).
//   - developer / support (escalation): New (claimable) counts; Assigned
//     counts ONLY when assignedTo is the user (or nobody yet).
// In Progress / Waiting / Resolved / Closed never count (via isCriticalUnworked).
export function isCriticalActionable(request, user) {
  if (!isCriticalUnworked(request)) return false;
  if (!request || !user) return false;
  if (user.role === 'admin' || user.role === 'client') return true;
  const status = getStatusName(request.status ?? request.statusName);
  if (status === 'New') return true;
  // Assigned: only the assignee (an unassigned-but-Assigned row is still
  // claimable, so it stays actionable for anyone who can claim it).
  if (!request.assignedTo) return true;
  return String(request.assignedTo) === String(user.id);
}

export default isCriticalUnworked;
