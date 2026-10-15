import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Modal, ConfirmDialog } from '../../components/common/Modal.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Action
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Receive Goods Modal
  const [confirmReceiveOpen, setConfirmReceiveOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [receiptSummary, setReceiptSummary] = useState(null);

  // Cancel Order Modal
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleUpdateStatus = async (nextStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await apiClient.patch(`/orders/${id}/status`, { status: nextStatus });
      setOrder(res.data);
      showSuccess(`Order status updated to ${nextStatus}`);
    } catch (err) {
      showError(err.message || `Failed to transition order to ${nextStatus}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const res = await apiClient.patch(`/orders/${id}/status`, { status: 'CANCELLED' });
      setOrder(res.data);
      showSuccess(`Purchase order ${order.poNo} has been cancelled`);
      setConfirmCancelOpen(false);
    } catch (err) {
      showError(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleReceiveConfirm = async () => {
    setReceiving(true);
    try {
      const res = await apiClient.post(`/orders/${id}/receive`);
      setOrder(res.data);
      setConfirmReceiveOpen(false);
      setReceiptSummary(res.data);
      showSuccess(`Goods receipt processed successfully for ${order.poNo}`);
    } catch (err) {
      showError(err.message || 'Failed to receive goods');
    } finally {
      setReceiving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading order details..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        title="Error Loading Order"
        message={error || 'Order not found'}
        onRetry={fetchOrder}
      />
    );
  }

  const isSupplier = user?.role === 'SUPPLIER';
  const isStoreManager = user?.role === 'STORE_MANAGER';
  const isProcurement = user?.role === 'PROCUREMENT_OFFICER';

  // Determine next supplier transition
  let supplierNextAction = null;
  if (isSupplier) {
    if (order.status === 'PLACED') {
      supplierNextAction = {
        label: 'Confirm Order',
        targetStatus: 'CONFIRMED',
        variant: 'primary',
        icon: 'bi-check2'
      };
    } else if (order.status === 'CONFIRMED') {
      supplierNextAction = {
        label: 'Mark as Shipped',
        targetStatus: 'SHIPPED',
        variant: 'info text-white',
        icon: 'bi-truck'
      };
    } else if (order.status === 'SHIPPED') {
      supplierNextAction = {
        label: 'Mark as Delivered',
        targetStatus: 'DELIVERED',
        variant: 'success text-white',
        icon: 'bi-box-seam'
      };
    }
  }

  const canStoreManagerReceive = isStoreManager && order.status === 'DELIVERED';
  const canProcurementCancel = isProcurement && ['PLACED', 'CONFIRMED'].includes(order.status);

  return (
    <div>
      <div className="mb-2">
        <Link
          to="/orders"
          className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1"
        >
          <i className="bi bi-arrow-left"></i>
          <span>Back to Purchase Orders</span>
        </Link>
      </div>

      <PageHeader
        title={
          <div className="d-flex align-items-center gap-3">
            <span className="font-monospace">{order.poNo}</span>
            <StatusBadge status={order.status} />
          </div>
        }
        description={`Issued to ${order.supplierName} on ${new Date(order.createdAt).toLocaleDateString()}`}
        action={
          <div className="d-flex align-items-center gap-2">
            {supplierNextAction && (
              <button
                type="button"
                id="supplier-status-action-btn"
                className={`btn btn-${supplierNextAction.variant} d-flex align-items-center gap-2`}
                onClick={() => handleUpdateStatus(supplierNextAction.targetStatus)}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                ) : (
                  <i className={`bi ${supplierNextAction.icon}`}></i>
                )}
                <span>{supplierNextAction.label}</span>
              </button>
            )}

            {canStoreManagerReceive && (
              <button
                type="button"
                id="receive-goods-btn"
                className="btn btn-success text-white d-flex align-items-center gap-2"
                onClick={() => setConfirmReceiveOpen(true)}
              >
                <i className="bi bi-box-seam"></i>
                <span>Receive Goods</span>
              </button>
            )}

            {canProcurementCancel && (
              <button
                type="button"
                id="cancel-order-btn"
                className="btn btn-outline-danger d-flex align-items-center gap-2"
                onClick={() => setConfirmCancelOpen(true)}
              >
                <i className="bi bi-x-circle"></i>
                <span>Cancel Order</span>
              </button>
            )}
          </div>
        }
      />

      <div className="row g-4">
        {/* Line Items Table */}
        <div className="col-lg-8">
          <Card title="Ordered Items">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr className="text-muted small text-uppercase">
                    <th>Item</th>
                    <th>SKU</th>
                    <th className="text-end">Quantity</th>
                    <th className="text-end">Unit Price</th>
                    <th className="text-end">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines?.map((line) => (
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
                        ₹{Number(line.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-end fw-semibold text-dark">
                        ₹{Number(line.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="table-light">
                    <td colSpan="4" className="text-end fw-semibold text-dark">
                      Grand Order Total:
                    </td>
                    <td className="text-end fw-bold fs-6 text-primary">
                      ₹{Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        {/* Order Meta Information */}
        <div className="col-lg-4">
          <Card title="Order Specifications">
            <div className="d-flex flex-column gap-3 small">
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Supplier:</span>
                <span className="fw-semibold text-dark">{order.supplierName}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Linked Request:</span>
                <button
                  type="button"
                  className="btn btn-link p-0 small fw-semibold text-decoration-none text-primary"
                  onClick={() => navigate(`/requests/${order.requestId}`)}
                >
                  View Request #{order.requestId}
                </button>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Expected Delivery:</span>
                <span className="fw-medium text-dark">
                  {order.expectedDate
                    ? new Date(order.expectedDate).toLocaleDateString()
                    : 'Not specified'}
                </span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Actual Delivery:</span>
                <span className="fw-medium text-dark">
                  {order.deliveredDate
                    ? new Date(order.deliveredDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-2">
                <span className="text-muted">Created By:</span>
                <span className="text-dark">{order.createdByName || 'Procurement Office'}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Created Date:</span>
                <span className="text-dark">{new Date(order.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Receive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmReceiveOpen}
        onClose={() => setConfirmReceiveOpen(false)}
        onConfirm={handleReceiveConfirm}
        title="Receive Goods into Inventory"
        message={`Are you sure you want to verify receipt of goods for ${order.poNo}? This will mark the order as RECEIVED and immediately credit each item's stock balance in the central warehouse ledger.`}
        confirmText="Confirm & Post Receipt"
        confirmVariant="success"
        loading={receiving}
      />

      {/* Cancel Order Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleCancelOrder}
        title="Cancel Purchase Order"
        message={`Are you sure you want to cancel purchase order ${order.poNo}? This action is irreversible.`}
        confirmText="Cancel Order"
        confirmVariant="danger"
        loading={cancelling}
      />

      {/* Goods Receipt Summary Modal */}
      <Modal
        isOpen={Boolean(receiptSummary)}
        onClose={() => setReceiptSummary(null)}
        title="Goods Receipt Summary"
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setReceiptSummary(null)}
          >
            Done
          </button>
        }
      >
        <div className="text-center py-2 mb-3">
          <i className="bi bi-check-circle-fill text-success fs-1"></i>
          <h3 className="h5 fw-bold text-dark mt-2 mb-1">Stock Successfully Credited</h3>
          <p className="text-muted small">
            Receipt movements recorded under transaction for order {receiptSummary?.poNo}.
          </p>
        </div>

        <div className="table-responsive border rounded">
          <table className="table table-sm align-middle mb-0">
            <thead className="table-light">
              <tr className="small text-muted text-uppercase">
                <th>Item</th>
                <th>SKU</th>
                <th className="text-end">Quantity Added</th>
              </tr>
            </thead>
            <tbody>
              {receiptSummary?.lines?.map((line) => (
                <tr key={line.id}>
                  <td className="fw-medium text-dark">{line.name}</td>
                  <td className="small text-secondary font-monospace">{line.sku}</td>
                  <td className="text-end fw-bold text-success">
                    +{line.quantity} {line.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

export default OrderDetailPage;
