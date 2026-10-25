import React from 'react';

export function FormField({
  label,
  error,
  helpText,
  required = false,
  children,
  className = '',
}) {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span style={{ color: 'var(--status-danger)', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      {children}
      {error && <span className="form-error">{error}</span>}
      {!error && helpText && <span className="form-help">{helpText}</span>}
    </div>
  );
}
