import React from 'react';

export function LoadingState({ rows = 5, message = 'Loading records...' }) {
  return (
    <div className="py-4">
      <div className="d-flex align-items-center gap-2 mb-3 text-muted small">
        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
        <span>{message}</span>
      </div>
      <div className="d-flex flex-column gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-box w-100" style={{ height: '36px' }}></div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while fetching information.',
  onRetry = null
}) {
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 my-3">
      <div className="d-flex align-items-center gap-2">
        <i className="bi bi-exclamation-triangle-fill fs-5"></i>
        <div>
          <strong className="d-block">{title}</strong>
          <span className="small">{message}</span>
        </div>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          <i className="bi bi-arrow-clockwise me-1"></i> Retry
        </button>
      )}
    </div>
  );
}

export default LoadingState;
