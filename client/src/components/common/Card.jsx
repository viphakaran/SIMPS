import React from 'react';

export function Card({ title, subtitle, headerAction, children, footer, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || headerAction) && (
        <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
          <div>
            {title && <h2 className="h6 mb-0 text-dark fw-semibold">{title}</h2>}
            {subtitle && <small className="text-muted">{subtitle}</small>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="card-body p-4">{children}</div>
      {footer && <div className="card-footer bg-light border-top py-2 px-4">{footer}</div>}
    </div>
  );
}

export function StatCard({ title, value, icon, subtext, className = '' }) {
  return (
    <div className={`card h-100 ${className}`}>
      <div className="card-body p-4 d-flex justify-content-between align-items-start">
        <div>
          <span className="text-muted small fw-medium text-uppercase">{title}</span>
          <h2 className="h3 my-2 fw-bold text-dark">{value}</h2>
          {subtext && <div className="text-muted small">{subtext}</div>}
        </div>
        {icon && (
          <div
            className="p-3 bg-light rounded text-primary d-flex align-items-center justify-content-center"
            style={{ width: '48px', height: '48px' }}
          >
            <i className={`bi ${icon} fs-5`}></i>
          </div>
        )}
      </div>
    </div>
  );
}

export default Card;
