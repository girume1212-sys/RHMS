



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










export function isCriticalActionable(request, user) {
  if (!isCriticalUnworked(request)) return false;
  if (!request || !user) return false;
  if (user.role === 'admin' || user.role === 'client') return true;
  const status = getStatusName(request.status ?? request.statusName);
  if (status === 'New') return true;
  
  
  if (!request.assignedTo) return true;
  return String(request.assignedTo) === String(user.id);
}

export default isCriticalUnworked;
