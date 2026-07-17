const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,20}$/;
const nameRegex = /^[A-Za-z\s'-]+$/;

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return '';
}

export function validateName(value, fieldName = 'Name') {
  if (!value || !value.trim()) return `${fieldName} is required`;
  if (!nameRegex.test(value.trim())) return `${fieldName} must not contain numbers or special characters`;
  return '';
}

export function validateEmail(value) {
  if (!value || !value.trim()) return 'Email is required';
  if (!emailRegex.test(value.trim())) return 'Please enter a valid email address';
  return '';
}

export function validateMinLength(value, min, fieldName) {
  if (!value || !value.trim()) return `${fieldName} is required`;
  if (value.trim().length < min) return `${fieldName} must be at least ${min} characters`;
  return '';
}

export function validateDescription(value, min = 20, max = 1000) {
  if (!value || !value.trim()) return 'Description is required';
  if (value.trim().length < min) return `Description must be at least ${min} characters`;
  if (value.trim().length > max) return `Description must not exceed ${max} characters`;
  return '';
}

export function validateSubject(value, min = 3, max = 100) {
  if (!value || !value.trim()) return 'Subject is required';
  if (value.trim().length < min) return `Subject must be at least ${min} characters`;
  if (value.trim().length > max) return `Subject must not exceed ${max} characters`;
  return '';
}

export function validatePassword(value) {
  if (!value) return 'Password is required';
  if (value.length < 6) return 'Password must be at least 6 characters';
  return '';
}

export function validatePasswordMatch(password, confirmPassword) {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return '';
}

export function validatePhone(value) {
  if (!value || !value.trim()) return '';
  if (!phoneRegex.test(value.trim())) return 'Please enter a valid phone number';
  return '';
}

export function validateFileType(file, allowedTypes) {
  if (!allowedTypes.some(type => file.type.startsWith(type))) {
    return `Invalid file type. Allowed: ${allowedTypes.join(', ')}`;
  }
  return '';
}

export function validateFileSize(file, maxMB) {
  if (file.size > maxMB * 1024 * 1024) {
    return `File must be less than ${maxMB}MB`;
  }
  return '';
}
