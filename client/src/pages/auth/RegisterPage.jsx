import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function RegisterPage() {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [deptError, setDeptError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError(null);
    try {
      const res = await apiClient.get('/departments/public');
      setDepartments(res.data || []);
      if (res.data && res.data.length > 0) {
        setDepartmentId(String(res.data[0].id));
      }
    } catch {
      setDeptError('Failed to load departments. Please try again.');
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!departmentId) {
      setError('Please select a department.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        phone: phone ? phone.trim() : undefined,
        departmentId: Number(departmentId)
      });
      setIsSuccess(true);
    } catch (err) {
      const errData = err.response?.data?.error;
      if (errData?.details && Array.isArray(errData.details)) {
        const fieldMap = {};
        for (const detail of errData.details) {
          if (detail.path) {
            fieldMap[detail.path] = detail.message;
          }
        }
        setFieldErrors(fieldMap);
      }
      setError(errData?.message || 'Registration failed. Please review the details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#F6F7F9' }}>
        <div className="card shadow-sm border text-center p-4 p-sm-5" style={{ maxWidth: '460px', width: '100%', borderRadius: '12px' }}>
          <div
            className="rounded-circle bg-success bg-opacity-10 text-success d-inline-flex align-items-center justify-content-center mx-auto mb-3"
            style={{ width: '64px', height: '64px' }}
          >
            <i className="bi bi-check-circle-fill fs-2"></i>
          </div>
          <h2 className="h4 fw-bold text-dark mb-2">Registration Submitted</h2>
          <p className="text-muted small mb-4">
            Your account has been created with role <span className="badge bg-secondary">REQUESTER</span> and is currently{' '}
            <span className="badge bg-warning text-dark">PENDING</span> administrator approval.
            You will be able to log in once your department or system administrator activates your account.
          </p>
          <Link to="/login" className="btn btn-primary py-2 w-100 fw-medium text-decoration-none">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#F6F7F9' }}>
      <div className="card shadow-sm border" style={{ maxWidth: '480px', width: '100%', borderRadius: '12px' }}>
        <div className="card-body p-4 p-sm-5">
          <div className="text-center mb-4">
            <div
              className="bg-primary text-white rounded-3 d-inline-flex align-items-center justify-content-center mb-3 shadow-sm"
              style={{ width: '48px', height: '48px' }}
            >
              <i className="bi bi-box-fill fs-4"></i>
            </div>
            <h1 className="h4 fw-bold text-dark mb-1">Create an Account</h1>
            <p className="text-muted small mb-0">Register as a department faculty / staff requester</p>
          </div>

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-3 small" role="alert">
              <i className="bi bi-exclamation-circle-fill fs-5 flex-shrink-0"></i>
              <div>{error}</div>
            </div>
          )}

          {deptError && (
            <ErrorState
              title="Unable to load departments"
              message={deptError}
              onRetry={fetchDepartments}
            />
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="reg-name">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                className={`form-control ${fieldErrors.name ? 'is-invalid' : ''}`}
                placeholder="Dr. K. Saravanan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
              {fieldErrors.name && <div className="invalid-feedback">{fieldErrors.name}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="reg-email">
                Email address <span className="text-danger">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                placeholder="saravanan@ritrjpm.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
              {fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="reg-dept">
                Department <span className="text-danger">*</span>
              </label>
              {loadingDepts ? (
                <div className="form-control text-muted small d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  <span>Loading departments...</span>
                </div>
              ) : (
                <select
                  id="reg-dept"
                  className={`form-select ${fieldErrors.departmentId ? 'is-invalid' : ''}`}
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                  disabled={submitting || departments.length === 0}
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.departmentId && <div className="invalid-feedback">{fieldErrors.departmentId}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="reg-phone">
                Phone Number <span className="text-muted">(Optional)</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                className="form-control"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary" htmlFor="reg-password">
                Password <span className="text-danger">*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={submitting}
              />
              {fieldErrors.password && <div className="invalid-feedback">{fieldErrors.password}</div>}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-medium d-flex align-items-center justify-content-center gap-2"
              disabled={submitting || loadingDepts || departments.length === 0}
            >
              {submitting && <span className="spinner-border spinner-border-sm" role="status"></span>}
              <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
            </button>
          </form>

          <div className="text-center mt-4 pt-2 border-top">
            <span className="text-muted small">Already have an account? </span>
            <Link to="/login" className="small fw-semibold text-decoration-none">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
