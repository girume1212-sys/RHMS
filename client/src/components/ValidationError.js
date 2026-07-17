import React from 'react';

export default function ValidationError({ message }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}
