import React from 'react';

export function EmptyState({
  icon = 'bi-inbox',
  title = 'No data found',
  message = 'There are no records to display at this time.',
  action = null
}) {
  return (
    <div className="text-center py-5 px-3">
      <div className="text-muted mb-3">
        <i className={`bi ${icon} fs-1`}></i>
      </div>
      <h3 className="h6 fw-semibold text-dark mb-1">{title}</h3>
      <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: '400px' }}>
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}

export default EmptyState;
