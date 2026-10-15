import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Modal, ConfirmReason } from '../../components/common/Modal.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function ProcurementPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [suppliers, setSuppliers] = useState([]);

  // Create PO Modal
  const [poTargetRequest, setPoTargetRequest] = useState(null);
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poLines, setPoLines] = useState([]);
  const [creatingPo, setCreatingPo] = useState(false);
  const [poError, setPoError] = useState(null);

  // Return Modal
  const [returnTargetRequest, setReturnTargetRequest] = useState(null);
  const [returning, setReturning] = useState(false);

  const fetchSuppliers = async () => {
    try {
      const res = await apiClient.get('/suppliers', { params: { pageSize: 100 } });
      const activeOnly = (res.data.data || []).filter((s) => s.isActive);
      setSuppliers(activeOnly);
    } catch {
      // suppliers fallback
    }
  };

  const fetchApprovedRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/requests', {
        params: {
          status: 'APPROVED',
          page,
          pageSize
        }
      });
      setRequests(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load approved purchase requests');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchApprovedRequests();
    fetchSuppliers();
  }, [fetchApprovedRequests]);

  const handleOpenPoModal = async (reqSummary) => {
    setPoError(null);
    try {
      // Fetch full request to get all line items with IDs and unit costs
      const res = await apiClient.get(`/requests/${reqSummary.id}`);
      const fullReq = res.data;
      setPoTargetRequest(fullReq);

      // Default expected date = 7 days from today
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setPoExpectedDate(defaultDate.toISOString().slice(0, 10));

      const firstSupplierId = suppliers.length > 0 ? String(suppliers[0].id) : '';

      const initializedLines = (fullReq.lines || []).map((l) => ({
        requestItemId: l.id,
        name: l.name,
        sku: l.sku,
        unit: l.unit,
        quantity: l.quantity,
        supplierId: firstSupplierId,
        unitPrice: Number(l.unitCost || 0)
      }));
      setPoLines(initializedLines);
    } catch (err) {
      showError(err.message || 'Failed to load line items for order generation');
    }
  };

  const handlePoLineChange = (index, field, value) => {
    const updated = [...poLines];
    updated[index] = { ...updated[index], [field]: value };
    setPoLines(updated);
  };

  const livePoTotal = poLines.reduce(
    (acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  );

  const handleCreateOrdersSubmit = async (e) => {
    e.preventDefault();
    setPoError(null);

    if (suppliers.length === 0) {
      setPoError('No active suppliers available. Please register and activate suppliers first.');
      return;
    }

    if (poLines.some((l) => !l.supplierId)) {
      setPoError('Each item line must be assigned an active supplier.');
      return;
    }

    if (poLines.some((l) => Number(l.unitPrice) <= 0)) {
      setPoError('Unit price must be greater than 0 for all items.');
      return;
    }

    setCreatingPo(true);
    try {
      const payload = {
        expectedDate: poExpectedDate || undefined,
        lines: poLines.map((l) => ({
          requestItemId: l.requestItemId,
          supplierId: Number(l.supplierId),
          unitPrice: Number(l.unitPrice)
        }))
      };

      const res = await apiClient.post(`/requests/${poTargetRequest.id}/orders`, payload);
      showSuccess(`Created ${res.data.orders?.length || 1} purchase order(s) successfully`);
      setPoTargetRequest(null);
      fetchApprovedRequests();
    } catch (err) {
      setPoError(err.message || 'Failed to generate purchase orders');
    } finally {
      setCreatingPo(false);
    }
  };

  const handleReturnConfirm = async (reason) => {
    if (!returnTargetRequest) return;
    setReturning(true);
    try {
      await apiClient.post(`/requests/${returnTargetRequest.id}/return`, { reason });
      showSuccess(`Request ${returnTargetRequest.reqNo} returned to requester`);
      setReturnTargetRequest(null);
      fetchApprovedRequests();
    } catch (err) {
      showError(err.message || 'Failed to return request');
    } finally {
      setReturning(false);
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
      render: (r) => <span className="small text-dark fw-medium">{r.requestedByName || '—'}</span>
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
      label: 'Lines',
      render: (r) => (
        <span className="badge bg-light text-dark border">{r.linesCount ?? r.itemsCount ?? '—'}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: 'actions',
      label: 'Procurement Actions',
      className: 'text-end',
      render: (r) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => navigate(`/requests/${r.id}`)}
            title="View Details"
          >
            <i className="bi bi-eye me-1"></i>View
          </button>
          <button
            type="button"
            id={`create-po-btn-${r.id}`}
            className="btn btn-sm btn-primary py-1 px-2"
            onClick={() => handleOpenPoModal(r)}
            title="Create Purchase Orders"
          >
            <i className="bi bi-cart-plus me-1"></i>Create PO
          </button>
          <button
            type="button"
            id={`return-btn-${r.id}`}
            className="btn btn-sm btn-outline-danger py-1 px-2"
            onClick={() => setReturnTargetRequest(r)}
            title="Return Request with Reason"
          >
            <i className="bi bi-arrow-return-left me-1"></i>Return
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Procurement Processing"
        description="Approved purchase requisitions awaiting supplier assignment and purchase order generation."
      />

      {error ? (
        <ErrorState
          title="Failed to load procurement queue"
          message={error}
          onRetry={fetchApprovedRequests}
        />
      ) : (
        <DataTable
          columns={columns}
          data={requests}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyTitle="No Approved Requests Waiting"
          emptyMessage="All approved requisitions have been processed into purchase orders or returned."
        />
      )}

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={Boolean(poTargetRequest)}
        onClose={() => setPoTargetRequest(null)}
        title={`Generate Purchase Orders — ${poTargetRequest?.reqNo}`}
        size="modal-xl"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100">
            <div>
              <span className="text-muted small me-2">Grand Total:</span>
              <span className="fw-bold fs-5 text-primary">
                ₹{livePoTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setPoTargetRequest(null)}
                disabled={creatingPo}
              >
                Cancel
              </button>
              <button
                type="button"
                id="submit-po-form-btn"
                className="btn btn-primary d-flex align-items-center gap-2"
                onClick={handleCreateOrdersSubmit}
                disabled={creatingPo || suppliers.length === 0}
              >
                {creatingPo ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Generating Orders...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle"></i>
                    <span>Generate Purchase Orders</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateOrdersSubmit}>
          {poError && (
            <div className="alert alert-danger py-2 px-3 mb-3 small d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{poError}</span>
            </div>
          )}

          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label htmlFor="po-expected-date" className="form-label small fw-semibold text-dark">
                Expected Delivery Date
              </label>
              <input
                id="po-expected-date"
                type="date"
                className="form-control"
                value={poExpectedDate}
                onChange={(e) => setPoExpectedDate(e.target.value)}
                disabled={creatingPo}
              />
              <div className="form-text small">
                Target delivery date entered for supplier SLAs.
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-dark">
                Requisition Source
              </label>
              <div className="p-2 bg-light rounded border text-muted small">
                <strong>{poTargetRequest?.departmentName}</strong> &bull; Requested by{' '}
                {poTargetRequest?.requestedByName}
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr className="text-muted small text-uppercase">
                  <th style={{ width: '30%' }}>Item</th>
                  <th style={{ width: '15%' }} className="text-end">Qty</th>
                  <th style={{ width: '30%' }}>Assign Supplier</th>
                  <th style={{ width: '25%' }} className="text-end">Unit Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {poLines.map((line, idx) => (
                  <tr key={line.requestItemId}>
                    <td>
                      <div className="fw-medium text-dark">{line.name}</div>
                      <div className="small text-muted font-monospace">{line.sku}</div>
                    </td>
                    <td className="text-end fw-medium">
                      {line.quantity} {line.unit}
                    </td>
                    <td>
                      <select
                        id={`po-supplier-select-${idx}`}
                        className="form-select form-select-sm"
                        value={line.supplierId}
                        onChange={(e) => handlePoLineChange(idx, 'supplierId', e.target.value)}
                        required
                        disabled={creatingPo}
                      >
                        <option value="">Select Supplier...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-end">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">₹</span>
                        <input
                          id={`po-unit-price-${idx}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-control text-end"
                          value={line.unitPrice}
                          onChange={(e) => handlePoLineChange(idx, 'unitPrice', e.target.value)}
                          required
                          disabled={creatingPo}
                        />
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                        Line: ₹{((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </Modal>

      {/* Return Request with Reason Modal */}
      <ConfirmReason
        isOpen={Boolean(returnTargetRequest)}
        onClose={() => setReturnTargetRequest(null)}
        onConfirm={handleReturnConfirm}
        title={`Return Request ${returnTargetRequest?.reqNo}`}
        message="Specify why this approved requisition is being returned to the requester (e.g., budget limit, alternative available, discontinued item)."
        placeholder="Enter return reason (required)..."
        confirmText="Return Requisition"
        confirmVariant="danger"
        loading={returning}
        required={true}
      />
    </div>
  );
}

export default ProcurementPage;
