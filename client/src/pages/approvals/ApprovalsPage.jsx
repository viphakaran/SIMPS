import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { ConfirmDialog, ConfirmReason } from '../../components/common/Modal.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Decision Modals
  const [approveItem, setApproveItem] = useState(null);
  const [approving, setApproving] = useState(false);

  const [rejectItem, setRejectItem] = useState(null);
  const [rejecting, setRejecting] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/requests', {
        params: {
          queue: 'true',
          page,
          pageSize
        }
      });
      setQueue(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load approvals queue');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleApprove = async () => {
    if (!approveItem) return;
    setApproving(true);
    try {
      await apiClient.post(`/requests/${approveItem.id}/decision`, {
        decision: 'APPROVED'
      });
      showSuccess(`Request ${approveItem.reqNo} approved successfully`);
      setApproveItem(null);
      fetchQueue();
    } catch (err) {
      showError(err.message || 'Failed to approve request');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (reason) => {
    if (!rejectItem) return;
    setRejecting(true);
    try {
      await apiClient.post(`/requests/${rejectItem.id}/decision`, {
        decision: 'REJECTED',
        reason
      });
      showSuccess(`Request ${rejectItem.reqNo} rejected`);
      setRejectItem(null);
      fetchQueue();
    } catch (err) {
      showError(err.message || 'Failed to reject request');
    } finally {
      setRejecting(false);
    }
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
      render: (r) => (
        <div>
          <div className="fw-medium text-dark small">{r.requestedByName || '—'}</div>
          <div className="text-muted" style={{ fontSize: '11px' }}>
            {r.requestedByEmail}
          </div>
        </div>
      )
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r) => {
        if (r.priority === 'HIGH') return <span className="badge bg-danger">HIGH</span>;
        if (r.priority === 'LOW') return <span className="badge bg-secondary">LOW</span>;
        return <span className="badge bg-light text-dark border">NORMAL</span>;
      }
    },
    {
      key: 'linesCount',
      label: 'Items',
      render: (r) => (
        <span className="badge bg-light text-dark border">{r.linesCount ?? r.itemsCount ?? '—'} lines</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      render: (r) => (
        <span className="text-muted small">
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Decision',
      className: 'text-end',
      render: (r) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => navigate(`/requests/${r.id}`)}
            title="Inspect Request Details"
          >
            <i className="bi bi-eye me-1"></i>View
          </button>
          <button
            type="button"
            id={`approve-btn-${r.id}`}
            className="btn btn-sm btn-success py-1 px-2 text-white"
            onClick={() => setApproveItem(r)}
            title="Approve Requisition"
          >
            <i className="bi bi-check-lg me-1"></i>Approve
          </button>
          <button
            type="button"
            id={`reject-btn-${r.id}`}
            className="btn btn-sm btn-outline-danger py-1 px-2"
            onClick={() => setRejectItem(r)}
            title="Reject Requisition"
          >
            <i className="bi bi-x-lg me-1"></i>Reject
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Approvals Queue"
        description={
          user?.role === 'PRINCIPAL'
            ? 'Review and decide on requisitions escalated for Principal approval.'
            : `Review and decide on purchase requisitions submitted for ${user?.departmentName || 'your department'}.`
        }
      />

      {error ? (
        <ErrorState
          title="Failed to load approvals"
          message={error}
          onRetry={fetchQueue}
        />
      ) : (
        <DataTable
          columns={columns}
          data={queue}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyTitle="Approvals Queue is Clear"
          emptyMessage="There are currently no purchase requests awaiting your review or decision."
        />
      )}

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(approveItem)}
        onClose={() => setApproveItem(null)}
        onConfirm={handleApprove}
        title="Approve Purchase Request"
        message={`Are you sure you want to approve requisition ${approveItem?.reqNo} submitted by ${approveItem?.requestedByName}? Approved requests will be sent to the Procurement Office for order generation.`}
        confirmText="Approve Requisition"
        confirmVariant="success"
        loading={approving}
      />

      {/* Reject with Reason Modal */}
      <ConfirmReason
        isOpen={Boolean(rejectItem)}
        onClose={() => setRejectItem(null)}
        onConfirm={handleReject}
        title={`Reject Requisition ${rejectItem?.reqNo}`}
        message="Please provide a specific justification or feedback for rejecting this requisition. The requester will be notified."
        placeholder="Enter rejection reason (required)..."
        confirmText="Reject Requisition"
        confirmVariant="danger"
        loading={rejecting}
        required={true}
      />
    </div>
  );
}

export default ApprovalsPage;
