import React from 'react';

export function FormField({
  label,
  id,
  hint,
  error,
  required = false,
  children,
  className = ''
}) {
  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label fw-medium small mb-1 text-dark">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="form-text text-muted small mt-1">{hint}</div>}
      {error && <div className="invalid-feedback d-block small mt-1">{error}</div>}
    </div>
  );
}

export default FormField;
