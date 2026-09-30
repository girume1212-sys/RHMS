import { translate } from './i18n/translate';

export const API_BASE = process.env.REACT_APP_API_URL || '';

const SERVER_ERROR_MAP = {
  'Invalid username, email or password': 'common.invalidCredentials',
  'Account locked due to too many failed attempts. Contact administrator.': 'common.accountLockedContactAdmin',
  'System is under maintenance. Please try again later.': 'common.systemUnderMaintenance',
  'Server error': 'common.serverError',
  'Database error': 'common.databaseError',
  'Email already exists': 'common.emailAlreadyExists',
  'Name, email and password are required': 'common.nameEmailPasswordRequired',
  'Name is required': 'common.nameRequired',
  'Please try again': 'common.pleaseTryAgain',
  'User not found': 'common.userNotFound',
  'User ID is required': 'common.userIdRequired',
  'Category not found': 'common.categoryNotFound',
  'Company not found': 'common.companyNotFound',
  'Company name is required': 'common.companyNameRequired',
  'Company ID already exists': 'common.companyIdExists',
  'Group not found': 'common.groupNotFound',
  'Feedback not found': 'common.feedbackNotFound',
  'Request not found': 'common.requestNotFound',
  'Access denied': 'common.accessDenied',
  'Insufficient permissions': 'common.insufficientPermissions',
  'Please fill all required fields': 'common.fillRequiredFields',
  'Access denied - you can only modify requests assigned to you': 'common.accessDeniedOwnRequests',
  'Access denied - new requests cannot be modified by the escalation team': 'common.accessDeniedNewRequests',
  'Access denied - request assigned to another user': 'common.accessDeniedRequestAssigned',
  'Access denied - you are not a member of a group assigned to this request': 'common.notGroupMember',
  'Reopening requests is not allowed. Contact an administrator.': 'common.reopenNotAllowed',
  'You can only close or reject a request that is in Resolved status.': 'common.closeRejectResolvedOnly',
  'You must claim and assign this request to yourself before changing its status': 'common.claimBeforeStatusChange',
  'Request is already assigned to another user': 'common.alreadyAssigned',
  'Clients cannot claim requests': 'common.clientsCannotClaim',
  'Escalation team can only claim escalated requests': 'common.escalationOnlyClaim',
  'Rating must be 1-5': 'common.ratingRange',
  'No file uploaded': 'common.noFileUploaded',
  'File too large. Max 10MB.': 'common.fileTooLarge',
  'Google authentication failed': 'common.googleSignInFailed',
  'Google credential is required': 'common.googleCredentialRequired',
  'Failed to clear activity log': 'common.failedClearActivity',
  'Invalid table name': 'common.invalidTableName',
  'Not found': 'common.notFound',
  'No token provided': 'common.sessionExpired',
  'Invalid token': 'common.sessionExpired',
  'Your account is blocked. You cannot submit requests.': 'common.accountBlocked',
};

function translateServerError(msg) {
  if (!msg) return null;
  const key = SERVER_ERROR_MAP[msg] ||
    (msg.startsWith('Failed to create request') ? 'common.failedToCreateRequest' : null) ||
    (msg.startsWith('Unexpected file field') ? 'common.uploadFailed' : null);
  return key ? translate(key) : null;
}

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch {
    return true;
  }
}

async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('rhms_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  } catch (err) {
    throw new Error(translate('common.cannotConnectServer'));
  }
  if (res.status === 401) {
    localStorage.removeItem('rhms_token');
    localStorage.removeItem('rhms_sessionTimeout');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=1';
    }
    throw new Error(translate('common.sessionExpired'));
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(translateServerError(data.error) || data.error || translate('common.requestFailed'));
    return data;
  }
  if (!res.ok) throw new Error(translate('common.requestFailedWithStatus') + ' ' + res.status);
  throw new Error(translate('common.unexpectedResponse'));
}

export const api = {
  get: (url) => apiFetch(url),
  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => apiFetch(url, { method: 'DELETE' }),
  upload: async (url, formData) => {
    const token = localStorage.getItem('rhms_token');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: formData });
    if (res.status === 401) {
      localStorage.removeItem('rhms_token');
      window.location.href = '/login?expired=1';
      throw new Error(translate('common.sessionExpired'));
    }
    const data = await res.json();
    if (!res.ok) throw new Error(translateServerError(data.error) || translate('common.uploadFailed'));
    return data;
  },
};
