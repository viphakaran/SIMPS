import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Timeline } from '../../components/common/Timeline.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';

export function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/requests/${id}`);
      setRequest(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase request details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiClient.post(`/requests/${id}/cancel`);
      showSuccess(`Purchase request ${request.reqNo} cancelled`);
      setConfirmCancelOpen(false);
      fetchRequest();
    } catch (err) {
      showError(err.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading request details..." />;
  }

  if (error || !request) {
    return (
      <ErrorState
        title="Error Loading Request"
        message={error || 'Request not found'}
        onRetry={fetchRequest}
      />
    );
  }

  const isOwner = request.requestedBy === user?.id;
  const isPending = ['PENDING_HOD', 'PENDING_PRINCIPAL'].includes(request.status);
  const canCancel = isOwner && isPending;

  const totalEstimated = (request.lines || []).reduce(
    (acc, l) => acc + (Number(l.estimatedTotal) || 0),
    0
  );

  return (
    <div>
      <div className="mb-2">
        <Link
          to="/requests"
          className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1"
        >
          <i className="bi bi-arrow-left"></i>
          <span>Back to Requests</span>
        </Link>
      </div>

      <PageHeader
        title={
          <div className="d-flex align-items-center gap-3">
            <span>{request.reqNo}</span>
            <StatusBadge status={request.status} />
          </div>
        }
        description={`Submitted by ${request.requestedByName} (${request.departmentName}) on ${new Date(
          request.createdAt
        ).toLocaleDateString()}`}
        action={
          canCancel && (
            <button
              type="button"
              id="cancel-request-btn"
              className="btn btn-outline-danger d-flex align-items-center gap-2"
              onClick={() => setConfirmCancelOpen(true)}
            >
              <i className="bi bi-x-circle"></i>
              <span>Cancel Request</span>
            </button>
          )
        }
      />

      <div className="row g-4">
        {/* Left Column: Lines & Linked POs */}
        <div className="col-lg-8">
          {/* Requisition Line Items */}
          <Card title="Requested Items">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr className="text-muted small text-uppercase">
                    <th>Item</th>
                    <th>SKU</th>
                    <th className="text-end">Quantity</th>
                    <th className="text-end">Unit Cost</th>
                    <th className="text-end">Est. Total</th>
                  </tr>
                </thead>
                <tbody>
                  {request.lines?.map((line) => (
                    <tr key={line.id}>
                      <td className="fw-medium text-dark">{line.name}</td>
                      <td>
                        <span className="badge bg-light text-secondary border font-monospace">
                          {line.sku}
                        </span>
                      </td>
                      <td className="text-end">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="text-end">
                        ₹{Number(line.unitCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-end fw-semibold text-dark">
                        ₹{Number(line.estimatedTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="table-light">
                    <td colSpan="4" className="text-end fw-semibold text-dark">
                      Total Estimated Amount:
                    </td>
                    <td className="text-end fw-bold fs-6 text-primary">
                      ₹{totalEstimated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Linked Purchase Orders */}
          <div className="mt-4">
            <Card title="Linked Purchase Orders">
              {!request.orders || request.orders.length === 0 ? (
                <p className="text-muted small mb-0">
                  No purchase orders generated for this request yet.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr className="text-muted small text-uppercase">
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th className="text-end">Amount</th>
                        <th className="text-end">Expected Date</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.orders.map((po) => (
                        <tr key={po.id}>
                          <td className="fw-semibold text-primary font-monospace">{po.poNo}</td>
                          <td className="text-dark fw-medium">{po.supplierName}</td>
                          <td>
                            <StatusBadge status={po.status} />
                          </td>
                          <td className="text-end fw-medium">
                            ₹{Number(po.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-end text-muted small">
                            {po.expectedDate
                              ? new Date(po.expectedDate).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-1 px-2"
                              onClick={() => navigate(`/orders/${po.id}`)}
                            >
                              <i className="bi bi-eye me-1"></i>View PO
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Right Column: Meta & Timeline */}
        <div className="col-lg-4">
          <Card title="Request Information">
            <div className="d-flex flex-column gap-3 small">
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Priority:</span>
                <span className="fw-semibold">
                  {request.priority === 'HIGH' && (
                    <span className="badge bg-danger">HIGH</span>
                  )}
                  {request.priority === 'LOW' && (
                    <span className="badge bg-secondary">LOW</span>
                  )}
                  {request.priority === 'NORMAL' && (
                    <span className="badge bg-light text-dark border">NORMAL</span>
                  )}
                </span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Department:</span>
                <span className="fw-medium text-dark">{request.departmentName}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Requester:</span>
                <span className="fw-medium text-dark">
                  {request.requestedByName} ({request.requestedByRole})
                </span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Email:</span>
                <span className="text-dark">{request.requestedByEmail}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Submitted At:</span>
                <span className="text-dark">
                  {new Date(request.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-muted d-block mb-1">Justification:</span>
                <div className="p-2 bg-light rounded text-dark border">
                  {request.justification || (
                    <span className="text-muted fst-italic">No justification provided.</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Approval Timeline */}
          <div className="mt-4">
            <Card title="Approval History">
              <Timeline items={request.approvals} />
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Purchase Request"
        message={`Are you sure you want to cancel request ${request.reqNo}? This action is immediate and permanent.`}
        confirmText="Cancel Request"
        confirmVariant="danger"
        loading={cancelling}
      />
    </div>
  );
}

export default RequestDetailPage;
