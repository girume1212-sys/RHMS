import { translate } from '../i18n/translate';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,20}$/;
const nameRegex = /^[A-Za-z\s'-]+$/;

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return translate('validation.isRequired', { field: fieldName });
  }
  return '';
}

export function validateName(value, fieldName = 'Name') {
  if (!value || !value.trim()) return translate('validation.isRequired', { field: fieldName });
  if (!nameRegex.test(value.trim())) return translate('validation.nameInvalid', { field: fieldName });
  return '';
}

export function validateEmail(value) {
  if (!value || !value.trim()) return translate('validation.emailRequired');
  if (!emailRegex.test(value.trim())) return translate('validation.emailInvalid');
  return '';
}

export function validateMinLength(value, min, fieldName) {
  if (!value || !value.trim()) return translate('validation.isRequired', { field: fieldName });
  if (value.trim().length < min) return translate('validation.minLength', { field: fieldName, min });
  return '';
}

export function validateDescription(value, min = 20, max = 1000) {
  if (!value || !value.trim()) return translate('validation.descriptionRequired');
  if (value.trim().length < min) return translate('validation.descriptionMin', { min });
  if (value.trim().length > max) return translate('validation.descriptionMax', { max });
  return '';
}

export function validateSubject(value, min = 3, max = 100) {
  if (!value || !value.trim()) return translate('validation.subjectRequired');
  if (value.trim().length < min) return translate('validation.subjectMin', { min });
  if (value.trim().length > max) return translate('validation.subjectMax', { max });
  return '';
}

export function validatePassword(value) {
  if (!value) return translate('validation.passwordRequired');
  if (value.length < 6) return translate('validation.passwordMin');
  return '';
}

export function validatePasswordMatch(password, confirmPassword) {
  if (!confirmPassword) return translate('validation.confirmPasswordRequired');
  if (password !== confirmPassword) return translate('validation.passwordMismatch');
  return '';
}

export function validatePhone(value) {
  if (!value || !value.trim()) return '';
  if (!phoneRegex.test(value.trim())) return translate('validation.phoneInvalid');
  return '';
}

export function validateFileType(file, allowedTypes) {
  if (!allowedTypes.some(type => file.type.startsWith(type))) {
    return translate('validation.fileTypeInvalid', { types: allowedTypes.join(', ') });
  }
  return '';
}

export function validateFileSize(file, maxMB) {
  if (file.size > maxMB * 1024 * 1024) {
    return translate('validation.fileSizeMax', { maxMB });
  }
  return '';
}
