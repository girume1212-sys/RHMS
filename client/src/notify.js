export function dispatchCrudNotification(message, type = 'info', requestId = null) {
  const event = new CustomEvent('crud-notification', {
    detail: { message, type, requestId, timestamp: new Date().toISOString() }
  });
  window.dispatchEvent(event);
}

export function showStatusToast(message, type = 'success') {
  const event = new CustomEvent('status-toast', {
    detail: { message, type, timestamp: new Date().toISOString() }
  });
  window.dispatchEvent(event);
}
