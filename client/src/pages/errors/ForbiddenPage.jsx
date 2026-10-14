import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#F6F7F9' }}>
      <div className="card shadow-sm border text-center p-4 p-sm-5" style={{ maxWidth: '480px', width: '100%', borderRadius: '12px' }}>
        <div
          className="rounded-circle bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center mx-auto mb-3"
          style={{ width: '64px', height: '64px' }}
        >
          <i className="bi bi-shield-lock-fill fs-2"></i>
        </div>
        <h1 className="h3 fw-bold text-dark mb-2">403 — Access Denied</h1>
        <p className="text-muted small mb-4">
          You do not have the required permissions or role scope to access this page or resource. If you believe this is an error, please contact your department Head or the system administrator.
        </p>
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-outline-secondary px-3" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-1"></i> Go Back
          </button>
          <Link to="/dashboard" className="btn btn-primary px-3 text-decoration-none">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForbiddenPage;
