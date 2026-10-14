import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#F6F7F9' }}>
      <div className="card shadow-sm border text-center p-4 p-sm-5" style={{ maxWidth: '480px', width: '100%', borderRadius: '12px' }}>
        <div
          className="rounded-circle bg-secondary bg-opacity-10 text-secondary d-inline-flex align-items-center justify-content-center mx-auto mb-3"
          style={{ width: '64px', height: '64px' }}
        >
          <i className="bi bi-question-circle-fill fs-2"></i>
        </div>
        <h1 className="h3 fw-bold text-dark mb-2">404 — Page Not Found</h1>
        <p className="text-muted small mb-4">
          The page or route you are looking for does not exist or may have been moved.
        </p>
        <Link to="/dashboard" className="btn btn-primary px-4 mx-auto text-decoration-none">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
