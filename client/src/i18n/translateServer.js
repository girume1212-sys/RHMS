export function transSeeded(name, ns, t) {
  if (!name) return name;
  const key = ns + '.' + name;
  const value = t(key);
  return value && value !== key ? value : name;
}

function extractAfter(message, marker) {
  const idx = message.indexOf(marker);
  if (idx === -1) return '';
  return message.slice(idx + marker.length).trim();
}

function extractStatus(message, t) {
  const match = message.match(/status changed to (.+)$/i);
  return match ? transSeeded(match[1].trim(), 'status', t) : '';
}

export function translateNotification(message, data, t) {
  if (!message) return '';
  const id = data?.requestId ?? '';

  if (message.startsWith('New request created')) {
    return t('notification.newRequest');
  }

  if (message.startsWith('Your request #') && message.includes('status changed to')) {
    return t('notification.yourRequestStatusChanged', { id, status: extractStatus(message, t) });
  }
  if (message.startsWith('Request #') && message.includes('status changed to')) {
    return t('notification.requestStatusChanged', { id, status: extractStatus(message, t) });
  }

  if (message.startsWith('You have been assigned to Request #')) {
    return t('notification.youAssigned', { id });
  }
  if (message.startsWith('Your request #') && message.includes('has been assigned to ')) {
    return t('notification.yourRequestAssigned', { id, assignee: extractAfter(message, 'has been assigned to ') });
  }
  if (message.startsWith('Request #') && message.includes(' assigned to ')) {
    return t('notification.requestAssigned', { id, assignee: extractAfter(message, ' assigned to ') });
  }

  if (message.startsWith('Your request #') && message.includes('has been claimed')) {
    return t('notification.yourRequestClaimed', { id });
  }
  if (message.startsWith('Request #') && message.includes(' claimed by ')) {
    return t('notification.requestClaimed', { id, assignee: extractAfter(message, ' claimed by ') });
  }

  if (message.startsWith('Request #') && message.trim().endsWith('deleted')) {
    return t('notification.requestDeleted', { id });
  }

  if (message.startsWith('New comment on your request #')) {
    return t('notification.commentOnYourRequest', { id, userName: extractAfter(message, 'by ') });
  }
  if (message.startsWith('New comment on Request #')) {
    return t('notification.commentOnRequest', { id, userName: extractAfter(message, 'by ') });
  }

  if (message.includes('available for your group')) {
    const m = message.match(/(\d+)/);
    return t('notification.groupRequests', { count: m ? m[1] : 0 });
  }

  return message;
}

const SETTING_LABELS = {
  systemName: 'System Name', companyName: 'Company Name', systemEmail: 'System Email', requestPrefix: 'Request Prefix',
  phoneNumber: 'Phone Number', address: 'Address', timeZone: 'Time Zone', language: 'Language',
  defaultDashboard: 'Default Dashboard', dateTimeFormat: 'Date/Time Format', defaultStatus: 'Default Status',
  defaultPriority: 'Default Priority', autoRequestId: 'Auto Request ID', maxFileSize: 'Max File Size',
  allowedFileTypes: 'Allowed File Types', allowReopen: 'Allow Reopen', emailNotifications: 'Email Notifications',
  inAppNotifications: 'In-App Notifications', notifyClientStatusChange: 'Client Status Change Notifications',
  notifyDeveloperAssignment: 'Developer Assignment Notifications', autoAssign: 'Auto Assign', soundAlerts: 'Sound Alerts',
  desktopNotifications: 'Desktop Notifications', passwordLength: 'Password Length', passwordExpiry: 'Password Expiry',
  sessionTimeout: 'Session Timeout', maxLoginAttempts: 'Max Login Attempts', twoFactorAuth: 'Two-Factor Authentication',
  theme: 'System Theme', accentColor: 'Accent Color', sidebarStyle: 'Sidebar Style', assignmentMode: 'Assignment Mode',
  defaultGroup: 'Default Group', maintenanceMode: 'Maintenance Mode', responseHours: 'Response Hours (SLA)',
  resolutionHours: 'Resolution Hours (SLA)', escalationEnabled: 'Escalation Enabled',
  autoEscalationMinutes: 'Auto-Escalation Minutes', workStart: 'Work Start Time', workEnd: 'Work End Time',
  weekendDays: 'Weekend Days', holidaysEnabled: 'Holidays Enabled', autoBackup: 'Auto Backup',
  backupFrequency: 'Backup Frequency', createRequestEnabled: 'Create Request Enabled',
  clientApprovalRequired: 'Client Account Approval',
};

function prettifySettingKey(key) {
  return String(key || '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function describeSettingChangeFrontend(key) {
  const label = SETTING_LABELS[key] || prettifySettingKey(key);
  return `Admin updated ${label}.`;
}

export function translateActivityMessage(message, type, t, details = null) {
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { details = null; }
  }
  if (!message) return '';

  if (type === 'settings_updated') {
    const descriptions = details?.descriptions;
    if (Array.isArray(descriptions) && descriptions.length) {
      return descriptions.join(' ');
    }
    const changes = details?.changes;
    const changeDetails = details?.changeDetails;
    if (Array.isArray(changes) && changes.length && typeof changes[0] === 'string' && !/^\\d+$/.test(changes[0]) && Array.isArray(changeDetails) && changeDetails.length) {
      return changes.map(describeSettingChangeFrontend).join(' ');
    }
    if (/^Settings updated: \\s*\\d/.test(message)) {
      return 'Settings updated.';
    }
    if (Array.isArray(changes) && changes.length) {
      return 'Settings updated.';
    }
  }
  if (message.startsWith('Changed status from ')) {
    const match = message.match(/Changed status from (.+) to (.+)/i);
    if (match) {
      return t('activity.statusChanged', {
        from: transSeeded(match[1].trim(), 'status', t),
        to: transSeeded(match[2].trim(), 'status', t),
      });
    }
  }

  if (message.startsWith('Assigned to ')) {
    return t('activity.assigned', { name: message.slice(12) });
  }

  if (message.startsWith('Claimed by ')) {
    return t('activity.claimed', { name: message.slice(11) });
  }

  if (message === 'New request created') {
    return t('activity.created');
  }

  if (message === 'New comment on request') {
    return t('activity.comment');
  }

  if (type === 'comment') {
    return t('activity.comment');
  }

  return message;
}
