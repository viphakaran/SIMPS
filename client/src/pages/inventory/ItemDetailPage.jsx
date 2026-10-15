import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';

export function ItemDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showSuccess } = useToast();

  const isStoreManager = user?.role === 'STORE_MANAGER';

  const [item, setItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [totalMovements, setTotalMovements] = useState(0);
  const [movementsPage, setMovementsPage] = useState(1);
  const pageSize = 15;

  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Departments for issue
  const [departments, setDepartments] = useState([]);

  // Modals for Store Manager
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [issueForm, setIssueForm] = useState({
    departmentId: '',
    quantity: 1,
    reason: ''
  });

  const [adjustForm, setAdjustForm] = useState({
    delta: 0,
    reason: ''
  });

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/items/${id}`);
      setItem(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadMovements = useCallback(async () => {
    setMovementsLoading(true);
    try {
      const res = await apiClient.get(`/items/${id}/movements`, {
        params: { page: movementsPage, pageSize }
      });
      setMovements(res.data.data || []);
      setTotalMovements(res.data.total || 0);
    } catch {
      // Non-blocking
    } finally {
      setMovementsLoading(false);
    }
  }, [id, movementsPage]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await apiClient.get('/departments?pageSize=100');
      setDepartments(res.data.data || []);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadItem();
    loadDepartments();
  }, [loadItem, loadDepartments]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const handleOpenIssue = () => {
    setIssueForm({
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      quantity: 1,
      reason: ''
    });
    setModalError(null);
    setShowIssueModal(true);
  };

  const handleOpenAdjust = () => {
    setAdjustForm({
      delta: 0,
      reason: ''
    });
    setModalError(null);
    setShowAdjustModal(true);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.post(`/items/${id}/issue`, {
        departmentId: Number(issueForm.departmentId),
        quantity: Number(issueForm.quantity),
        reason: issueForm.reason.trim() || undefined
      });
      showSuccess(`Issued ${issueForm.quantity} ${item.unit} successfully`);
      setShowIssueModal(false);
      loadItem();
      loadMovements();
    } catch (err) {
      setModalError(err.message || 'Failed to issue stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      if (Number(adjustForm.delta) === 0) {
        setModalError('Delta must be non-zero (e.g. +5 or -3)');
        setSubmitting(false);
        return;
      }
      if (!adjustForm.reason.trim()) {
        setModalError('Reason is strictly required for stock adjustment');
        setSubmitting(false);
        return;
      }

      await apiClient.post(`/items/${id}/adjust`, {
        delta: Number(adjustForm.delta),
        reason: adjustForm.reason.trim()
      });
      showSuccess('Stock adjustment recorded successfully');
      setShowAdjustModal(false);
      loadItem();
      loadMovements();
    } catch (err) {
      setModalError(err.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const movementColumns = [
    {
      key: 'createdAt',
      label: 'Date & Time',
      render: (m) => (
        <span className="small text-muted">
          {m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}
        </span>
      )
    },
    {
      key: 'type',
      label: 'Movement Type',
      render: (m) => {
        let badgeClass = 'bg-secondary';
        if (m.type === 'RECEIPT') badgeClass = 'bg-success';
        if (m.type === 'ISSUE') badgeClass = 'bg-warning text-dark';
        if (m.type === 'ADJUSTMENT') badgeClass = 'bg-info text-dark';
        return <span className={`badge ${badgeClass}`}>{m.type}</span>;
      }
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (m) => {
        const qty = Number(m.quantity);
        const isPositive = qty > 0;
        return (
          <span className={`fw-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? `+${qty}` : qty} {item?.unit}
          </span>
        );
      }
    },
    {
      key: 'balanceAfter',
      label: 'Balance After',
      render: (m) => (
        <span className="fw-semibold text-dark">
          {m.balanceAfter} {item?.unit}
        </span>
      )
    },
    {
      key: 'reason',
      label: 'Reason / Reference',
      render: (m) => {
        return (
          <div className="small">
            {m.reason && <span className="text-dark">{m.reason}</span>}
            {m.departmentName && (
              <span className="badge bg-light text-secondary border ms-1">
                Dept: {m.departmentName}
              </span>
            )}
            {!m.reason && !m.departmentName && <span className="text-muted">—</span>}
          </div>
        );
      }
    },
    {
      key: 'createdByName',
      label: 'Logged By',
      render: (m) => <span className="small text-muted">{m.createdByName || 'System'}</span>
    }
  ];

  if (loading) {
    return <LoadingState message="Loading inventory item details..." />;
  }

  if (error || !item) {
    return (
      <ErrorState
        title="Item Not Found"
        message={error || 'Unable to load item details.'}
        onRetry={loadItem}
      />
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/items" className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i>
          <span>Back to Inventory</span>
        </Link>
      </div>

      <PageHeader
        title={item.name}
        description={`Item stock profile, safety thresholds, and complete ledger history.`}
        action={
          <div className="d-flex align-items-center gap-2">
            <StatusBadge status={item.status} />
            {isStoreManager && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                  onClick={handleOpenIssue}
                  disabled={item.stockQty <= 0}
                >
                  <i className="bi bi-box-arrow-up"></i>
                  <span>Issue Stock</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                  onClick={handleOpenAdjust}
                >
                  <i className="bi bi-sliders"></i>
                  <span>Adjust Stock</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Item Overview Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Card title="Current Stock">
            <div className="h3 fw-bold text-dark mb-0">
              {item.stockQty} <span className="fs-6 text-muted fw-normal">{item.unit}</span>
            </div>
            <div className="text-muted small mt-1">Live physical count</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card title="Safety Threshold">
            <div className="h3 fw-bold text-dark mb-0">
              {item.minLevel} <span className="fs-6 text-muted fw-normal">{item.unit}</span>
            </div>
            <div className="text-muted small mt-1">Reorder minimum level</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card title="Unit Cost">
            <div className="h3 fw-bold text-dark mb-0">
              ₹{Number(item.unitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-muted small mt-1">Standard cost per {item.unit}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card title="Stock Valuation">
            <div className="h3 fw-bold text-dark mb-0">
              ₹{(Number(item.stockQty) * Number(item.unitCost)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-muted small mt-1">Total inventory value</div>
          </Card>
        </div>
      </div>

      {/* Movement Ledger */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0 fw-bold text-dark">Stock Movement Ledger</h2>
          <span className="text-muted small">{totalMovements} recorded movements</span>
        </div>
        <DataTable
          columns={movementColumns}
          data={movements}
          loading={movementsLoading}
          page={movementsPage}
          pageSize={pageSize}
          total={totalMovements}
          onPageChange={setMovementsPage}
          emptyTitle="No stock movements recorded"
          emptyMessage="No stock transactions have been posted for this item yet."
        />
      </div>

      {/* Issue Stock Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title={`Issue Stock — ${item.name}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowIssueModal(false)}>
              Cancel
            </button>
            <button type="submit" form="issue-form-modal" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Issuing...' : 'Issue Stock'}
            </button>
          </div>
        }
      >
        <form id="issue-form-modal" onSubmit={handleIssueSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <div className="bg-light p-3 rounded mb-3 small">
            <div><strong>Available Stock:</strong> {item.stockQty} {item.unit}</div>
          </div>

          <FormField label="Recipient Department" required>
            <select
              className="form-select"
              value={issueForm.departmentId}
              onChange={(e) => setIssueForm({ ...issueForm, departmentId: e.target.value })}
              required
              disabled={submitting}
            >
              <option value="">Select recipient department...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={`Quantity to Issue (${item.unit})`} required>
            <input
              type="number"
              min="1"
              max={item.stockQty}
              className="form-control"
              value={issueForm.quantity}
              onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Reason / Remarks" hint="Optional distribution note">
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Issued for Lab Experiments"
              value={issueForm.reason}
              onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })}
              disabled={submitting}
            />
          </FormField>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`Adjust Stock — ${item.name}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdjustModal(false)}>
              Cancel
            </button>
            <button type="submit" form="adjust-form-modal" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Adjustment'}
            </button>
          </div>
        }
      >
        <form id="adjust-form-modal" onSubmit={handleAdjustSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <div className="bg-light p-3 rounded mb-3 small">
            <div><strong>Current Stock:</strong> {item.stockQty} {item.unit}</div>
            <div><strong>New Stock will be:</strong> {Number(item.stockQty) + Number(adjustForm.delta || 0)} {item.unit}</div>
          </div>

          <FormField label="Stock Delta (Signed)" hint="Positive number adds stock, negative removes stock" required>
            <input
              type="number"
              step="1"
              className="form-control"
              placeholder="e.g. +10 or -3"
              value={adjustForm.delta}
              onChange={(e) => setAdjustForm({ ...adjustForm, delta: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Reason for Adjustment" hint="Mandatory audit trail reason" required>
            <textarea
              className="form-control"
              rows="2"
              placeholder="e.g. Broken during transit or physical stock count correction"
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              required
              disabled={submitting}
            ></textarea>
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

export default ItemDetailPage;
