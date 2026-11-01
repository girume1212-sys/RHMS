const { v4: uuidv4 } = require('uuid');
const pool = require('./db');


async function logActivity(options) {
  try {
    const {
      type,
      message,
      userId = null,
      requestId = null,
      entityType = null,
      entityId = null,
      ipAddress = null,
      userAgent = null,
      details = null,
      severity = 'info',
      req = null
    } = options;

    const id = uuidv4();
    const now = new Date().toISOString();

    let ip = ipAddress;
    let ua = userAgent;

    if (req) {
      ip = ip || req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
      ua = ua || req.headers['user-agent'] || null;
    }

    await pool.query(
      `INSERT INTO activity_log (id, type, request_id, user_id, message, created_at, entity_type, entity_id, ip_address, user_agent, details, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, type, requestId, userId, message, now, entityType, entityId, ip, ua, details ? JSON.stringify(details) : null, severity]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}


async function logActivityWithContext(type, message, req, options = {}) {
  await logActivity({
    type,
    message,
    userId: req.user?.id || options.userId || null,
    requestId: options.requestId || null,
    entityType: options.entityType || null,
    entityId: options.entityId || null,
    details: options.details || null,
    severity: options.severity || 'info',
    req
  });
}


async function logAuthActivity(action, user, req, details = {}) {
  const messages = {
    login_success: `${user?.name || 'User'} logged in successfully`,
    login_failed: `Failed login attempt for ${details.credential || 'unknown'}`,
    login_locked: `${user?.name || 'User'} account locked due to too many failed attempts`,
    logout: `${user?.name || 'User'} logged out`,
    signup: `${user?.name || 'User'} registered a new account`,
    google_login: `${user?.name || 'User'} logged in via Google`,
    google_signup: `${user?.name || 'User'} registered via Google`,
    password_reset_requested: `Password reset requested for ${details.email || 'unknown'}`,
    password_reset_completed: `${user?.name || 'User'} completed password reset`,
    password_changed: `${user?.name || 'User'} changed their password`,
    session_revoked: `${user?.name || 'User'} session was revoked`,
    account_blocked: `${user?.name || 'User'} account was blocked`,
    account_unblocked: `${user?.name || 'User'} account was unblocked`,
  };

  await logActivity({
    type: action,
    message: messages[action] || `Auth action: ${action}`,
    userId: user?.id || null,
    entityType: 'user',
    entityId: user?.id || null,
    details,
    severity: action === 'login_failed' || action === 'login_locked' ? 'warning' : 'info',
    req
  });
}


async function logRequestActivity(action, request, user, req, details = {}) {
  const messages = {
    created: `Request #${request.id} created`,
    updated: `Request #${request.id} updated`,
    deleted: `Request #${request.id} deleted`,
    viewed: `Request #${request.id} viewed`,
    claimed: `Request #${request.id} claimed by ${user?.name || 'Unknown'}`,
    assigned: `Request #${request.id} assigned to ${details.assigneeName || 'Unknown'}`,
    status_changed: `Request #${request.id} status changed from ${details.oldStatus} to ${details.newStatus}`,
    priority_changed: `Request #${request.id} priority changed from ${details.oldPriority} to ${details.newPriority}`,
    category_changed: `Request #${request.id} category changed from ${details.oldCategory} to ${details.newCategory}`,
    resolved: `Request #${request.id} resolved`,
    closed: `Request #${request.id} closed`,
    rejected: `Request #${request.id} rejected`,
    escalated: `Request #${request.id} escalated`,
    reopened: `Request #${request.id} reopened`,
    comment_added: `Comment added to request #${request.id}`,
    comment_deleted: `Comment deleted from request #${request.id}`,
    attachment_added: `Attachment added to request #${request.id}`,
    attachment_deleted: `Attachment deleted from request #${request.id}`,
    feedback_submitted: `Feedback submitted for request #${request.id}`,
    assigned_group_changed: `Request #${request.id} assigned group changed to ${details.groupName || 'Unknown'}`,
  };

  await logActivity({
    type: action,
    message: messages[action] || `Request action: ${action}`,
    userId: user?.id || null,
    requestId: request.id,
    entityType: 'request',
    entityId: request.id,
    details,
    severity: action === 'deleted' ? 'warning' : 'info',
    req
  });
}


async function logUserActivity(action, targetUser, performedBy, req, details = {}) {
  const messages = {
    user_created: `User ${targetUser?.name || 'Unknown'} created`,
    user_updated: `User ${targetUser?.name || 'Unknown'} updated`,
    user_deleted: `User ${targetUser?.name || 'Unknown'} deleted`,
    user_blocked: `User ${targetUser?.name || 'Unknown'} blocked`,
    user_unblocked: `User ${targetUser?.name || 'Unknown'} unblocked`,
    user_approved: `User ${targetUser?.name || 'Unknown'} approved`,
    profile_updated: `${targetUser?.name || 'User'} updated their profile`,
    password_changed: `${targetUser?.name || 'User'} changed their password`,
    avatar_updated: `${targetUser?.name || 'User'} updated their avatar`,
  };

  await logActivity({
    type: action,
    message: messages[action] || `User action: ${action}`,
    userId: performedBy?.id || null,
    entityType: 'user',
    entityId: targetUser?.id || null,
    details,
    severity: action === 'user_deleted' || action === 'user_blocked' ? 'warning' : 'info',
    req
  });
}


async function logGroupActivity(action, group, performedBy, req, details = {}) {
  const messages = {
    group_created: `Group "${group?.name || 'Unknown'}" created`,
    group_updated: `Group "${group?.name || 'Unknown'}" updated`,
    group_deleted: `Group "${group?.name || 'Unknown'}" deleted`,
    member_added: `Member added to group "${group?.name || 'Unknown'}"`,
    member_removed: `Member removed from group "${group?.name || 'Unknown'}"`,
  };

  await logActivity({
    type: action,
    message: messages[action] || `Group action: ${action}`,
    userId: performedBy?.id || null,
    entityType: 'group',
    entityId: group?.id || null,
    details,
    severity: action === 'group_deleted' ? 'warning' : 'info',
    req
  });
}


async function logCompanyActivity(action, company, performedBy, req, details = {}) {
  const messages = {
    company_created: `Company "${company?.name || 'Unknown'}" created`,
    company_updated: `Company "${company?.name || 'Unknown'}" updated`,
    company_deleted: `Company "${company?.name || 'Unknown'}" deleted`,
  };

  await logActivity({
    type: action,
    message: messages[action] || `Company action: ${action}`,
    userId: performedBy?.id || null,
    entityType: 'company',
    entityId: company?.id || null,
    details,
    severity: action === 'company_deleted' ? 'warning' : 'info',
    req
  });
}


async function logSettingsActivity(action, performedBy, req, details = {}) {
  const messages = {
    settings_updated: `Settings updated: ${Object.keys(details.changes || {}).join(', ')}`,
    settings_reset: 'Settings reset to defaults',
    logo_uploaded: 'System logo uploaded',
    logo_removed: 'System logo removed',
    maintenance_mode_changed: `Maintenance mode ${details.enabled ? 'enabled' : 'disabled'}`,
  };

  await logActivity({
    type: action,
    message: messages[action] || `Settings action: ${action}`,
    userId: performedBy?.id || null,
    entityType: 'settings',
    details,
    severity: action === 'maintenance_mode_changed' ? 'warning' : 'info',
    req
  });
}


async function logSearchActivity(searchType, query, user, req, details = {}) {
  await logActivity({
    type: 'search_performed',
    message: `Search performed: "${query}"`,
    userId: user?.id || null,
    entityType: 'search',
    details: { searchType, query, ...details },
    req
  });
}

module.exports = {
  logActivity,
  logActivityWithContext,
  logAuthActivity,
  logRequestActivity,
  logUserActivity,
  logGroupActivity,
  logCompanyActivity,
  logSettingsActivity,
  logSearchActivity
};
