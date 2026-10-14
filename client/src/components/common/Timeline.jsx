import React from 'react';
import { StatusBadge } from './StatusBadge.jsx';

export function Timeline({ items = [] }) {
  if (!items || items.length === 0) {
    return <p className="text-muted small mb-0">No approval history recorded yet.</p>;
  }

  return (
    <div className="position-relative ps-4 border-start border-2 ms-2 my-3">
      {items.map((item, index) => (
        <div key={item.id || index} className="mb-4 position-relative">
          <div
            className="position-absolute rounded-circle bg-primary"
            style={{
              width: '12px',
              height: '12px',
              left: '-23px',
              top: '4px'
            }}
          ></div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="fw-semibold text-dark small">{item.stage} Decision</span>
            <StatusBadge status={item.decision} />
            <span className="text-muted small">
              {new Date(item.decidedAt).toLocaleString()}
            </span>
          </div>
          <div className="small text-muted">
            Decided by: <span className="text-dark fw-medium">{item.decidedByName || 'System'}</span>
            {item.decidedByRole && <span> ({item.decidedByRole})</span>}
          </div>
          {item.reason && (
            <div className="p-2 mt-2 bg-light rounded text-dark small border">
              <em>&ldquo;{item.reason}&rdquo;</em>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default Timeline;
