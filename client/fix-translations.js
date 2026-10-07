const fs = require('fs');
let content = fs.readFileSync('src/i18n/translations.js', 'utf8');

// Helper: inject new keys into a language's settings block
function injectKeys(langCode, newKeys) {
  const entries = Object.entries(newKeys).map(([k, v]) => `${k}: '${v}'`).join(', ');
  
  // Find the settings block for this language - it ends with holidaysEnabledDesc or maintenanceModeDesc
  // We'll insert before the closing of the settings object
  const markers = ['maintenanceModeDesc:', 'holidaysEnabledDesc:', 'backupMaintenance:'];
  let inserted = false;
  
  for (const marker of markers) {
    if (inserted) break;
    const idx = content.indexOf(marker);
    if (idx === -1) continue;
    
    // Find the end of this key's value (next single quote followed by comma or })
    let pos = idx;
    let quoteCount = 0;
    while (pos < content.length && quoteCount < 2) {
      if (content[pos] === "'") quoteCount++;
      pos++;
    }
    // pos is now after the closing quote
    if (content[pos] === ',') {
      // Insert after the comma
      content = content.slice(0, pos + 1) + ' ' + entries + ',' + content.slice(pos + 1);
      inserted = true;
    }
  }
  
  if (!inserted) {
    console.log(`WARNING: Could not inject keys for ${langCode}`);
  }
  return inserted;
}

// English
injectKeys('en', {
  defaultPriority: 'Default Priority', low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
  requestEscalation: 'Request & Escalation', ticketAutoClose: 'Ticket Auto-Close Time', days: 'Days',
  assignmentRule: 'Default Assignment Rule', selectAssignmentRule: 'Select Assignment Rule',
  roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: 'Manual',
  escalationTrigger: 'Escalation Trigger', selectEscalationTrigger: 'Select Escalation Trigger',
  timeout: 'Timeout', priorityBased: 'Priority Based', noResponse: 'No Response',
  slaBreachAction: 'SLA Breach Action', selectSlaBreachAction: 'Select SLA Breach Action',
  escalateImmediately: 'Escalate Immediately', notifyManager: 'Notify Manager',
  autoAssignSenior: 'Auto-Assign to Senior', noAction: 'No Action',
  languageOptions: 'Language Options', primaryLanguage: 'Primary System Language',
  emailOnNewTicket: 'Email on New Ticket', emailOnNewTicketDesc: 'Notify when a new ticket is created',
  emailOnStatusChange: 'Email on Status Change', emailOnStatusChangeDesc: 'Notify when ticket status changes',
  emailOnEscalation: 'Email on Escalation', emailOnEscalationDesc: 'Notify when ticket is escalated',
  inAppNotifications: 'In-App Notifications', inAppAlerts: 'In-App Alerts',
  inAppAlertsDesc: 'Show alerts inside the application',
  escalationAlerts: 'Escalation Alerts', escalationAlertsDesc: 'Show escalation alerts in-app'
});

fs.writeFileSync('src/i18n/translations.js', content);
console.log('English keys injected');
