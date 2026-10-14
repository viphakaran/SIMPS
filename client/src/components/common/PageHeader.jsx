import React from 'react';

export function PageHeader({ title, description, action }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h1 className="h4 mb-1 text-dark">{title}</h1>
        {description && <p className="text-muted small mb-0">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default PageHeader;
