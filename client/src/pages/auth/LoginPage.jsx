import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsPending(false);
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const errData = err.response?.data?.error;
      if (errData?.code === 'ACCOUNT_PENDING') {
        setIsPending(true);
        setError(errData.message || 'Your account is pending administrator approval.');
      } else {
        setError(errData?.message || 'Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#F6F7F9' }}>
      <div className="card shadow-sm border" style={{ maxWidth: '420px', width: '100%', borderRadius: '12px' }}>
        <div className="card-body p-4 p-sm-5">
          {/* Logo / Header */}
          <div className="text-center mb-4">
            <div
              className="bg-primary text-white rounded-3 d-inline-flex align-items-center justify-content-center mb-3 shadow-sm"
              style={{ width: '48px', height: '48px' }}
            >
              <i className="bi bi-box-fill fs-4"></i>
            </div>
            <h1 className="h4 fw-bold text-dark mb-1">SmartInv</h1>
            <p className="text-muted small mb-0">Ramco Institute of Technology &bull; Central Store</p>
          </div>

          {/* Pending State Banner */}
          {isPending && (
            <div className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 mb-3 small" role="alert">
              <i className="bi bi-clock-history fs-5 flex-shrink-0 mt-1"></i>
              <div>
                <strong>Account Pending Approval</strong>
                <div>{error}</div>
              </div>
            </div>
          )}

          {/* Regular Error Alert */}
          {!isPending && error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-3 small" role="alert">
              <i className="bi bi-exclamation-circle-fill fs-5 flex-shrink-0"></i>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                placeholder="name@ritrjpm.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-medium d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
            >
              {loading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="text-center mt-4 pt-2 border-top">
            <span className="text-muted small">Need an account? </span>
            <Link to="/register" className="small fw-semibold text-decoration-none">
              Register as Requester
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
