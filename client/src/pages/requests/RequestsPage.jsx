import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING_HOD', label: 'Pending HoD' },
  { value: 'PENDING_PRINCIPAL', label: 'Pending Principal' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'RETURNED_BY_PROCUREMENT', label: 'Returned by Procurement' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export function RequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const canCreate = ['HOD', 'REQUESTER'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'mine'
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Cancel dialog
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter || undefined
      };
      if (activeTab === 'mine') {
        params.mine = 'true';
      }
      const res = await apiClient.get('/requests', { params });
      setRequests(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleCancelConfirm = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      await apiClient.post(`/requests/${confirmCancel.id}/cancel`);
      showSuccess(`Purchase request ${confirmCancel.reqNo} cancelled`);
      setConfirmCancel(null);
      fetchRequests();
    } catch (err) {
      showError(err.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  const getPriorityBadge = (p) => {
    if (p === 'HIGH') return <span className="badge bg-danger">HIGH</span>;
    if (p === 'LOW') return <span className="badge bg-secondary">LOW</span>;
    return <span className="badge bg-light text-dark border">NORMAL</span>;
  };

  const columns = [
    {
      key: 'reqNo',
      label: 'Request No',
      render: (r) => (
        <button
          type="button"
          className="btn btn-link p-0 text-start fw-semibold text-decoration-none text-primary"
          onClick={() => navigate(`/requests/${r.id}`)}
        >
          {r.reqNo}
        </button>
      )
    },
    {
      key: 'department',
      label: 'Department',
      render: (r) => <span className="small text-secondary">{r.departmentName || '—'}</span>
    },
    {
      key: 'requestedBy',
      label: 'Requester',
      render: (r) => <span className="small text-dark fw-medium">{r.requestedByName || '—'}</span>
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r) => getPriorityBadge(r.priority)
    },
    {
      key: 'itemsCount',
      label: 'Line Items',
      render: (r) => <span className="badge bg-light text-muted border">{r.linesCount ?? r.itemsCount ?? '—'}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (r) => (
        <span className="text-muted small">
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (r) => {
        const isOwner = r.requestedBy === user?.id;
        const isPending = ['PENDING_HOD', 'PENDING_PRINCIPAL'].includes(r.status);
        const canCancel = isOwner && isPending;

        return (
          <div className="d-flex justify-content-end gap-1">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary py-1 px-2"
              onClick={() => navigate(`/requests/${r.id}`)}
              title="View Request Details"
            >
              <i className="bi bi-eye me-1"></i>View
            </button>
            {canCancel && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger py-1 px-2"
                onClick={() => setConfirmCancel(r)}
                title="Cancel Request"
              >
                <i className="bi bi-x-circle me-1"></i>Cancel
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Requests"
        description="Department requisitions, approval status tracking, and line items."
        action={
          canCreate && (
            <Link to="/requests/new" className="btn btn-primary d-flex align-items-center gap-2">
              <i className="bi bi-plus-lg"></i>
              <span>New Purchase Request</span>
            </Link>
          )
        }
      />

      {/* Tabs */}
      {canCreate && (
        <ul className="nav nav-tabs mb-3 border-bottom">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'all' ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => {
                setActiveTab('all');
                setPage(1);
              }}
            >
              All Department Requests
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'mine' ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => {
                setActiveTab('mine');
                setPage(1);
              }}
            >
              My Requests Only
            </button>
          </li>
        </ul>
      )}

      {/* Filter Toolbar */}
      <div className="card shadow-sm border mb-4 p-3 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by request number, requester, or justification..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="col-md-4">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState title="Failed to load requests" message={error} onRetry={fetchRequests} />
      ) : (
        <DataTable
          columns={columns}
          data={requests}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyTitle="No purchase requests found"
          emptyMessage={
            canCreate
              ? "No requisitions have been raised yet. Click 'New Purchase Request' to create one."
              : 'No requisitions match your criteria.'
          }
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmCancel)}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Purchase Request"
        message={`Are you sure you want to cancel ${confirmCancel?.reqNo}? This cannot be undone.`}
        confirmText="Cancel Request"
        confirmVariant="danger"
        loading={cancelling}
      />
    </div>
  );
}

export default RequestsPage;
