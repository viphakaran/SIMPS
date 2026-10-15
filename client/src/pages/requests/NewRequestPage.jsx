import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { LoadingState } from '../../components/common/LoadingState.jsx';

export function NewRequestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess } = useToast();

  const [availableItems, setAvailableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [priority, setPriority] = useState('NORMAL');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState([
    { itemId: '', quantity: 1 }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await apiClient.get('/items', { params: { active: 'true', pageSize: 100 } });
      setAvailableItems(res.data.data || []);
      if (res.data.data?.length > 0) {
        setLines([{ itemId: String(res.data.data[0].id), quantity: 1 }]);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to load catalog items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAddLine = () => {
    // Find first item that isn't already selected
    const selectedIds = new Set(lines.map((l) => l.itemId));
    const nextItem = availableItems.find((it) => !selectedIds.has(String(it.id)));
    setLines([
      ...lines,
      { itemId: nextItem ? String(nextItem.id) : '', quantity: 1 }
    ]);
  };

  const handleRemoveLine = (index) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  // Check for duplicate items client-side
  const selectedItemIds = lines.map((l) => l.itemId).filter(Boolean);
  const hasDuplicateItems = new Set(selectedItemIds).size !== selectedItemIds.length;

  // Calculate live estimated total
  const estimatedTotal = lines.reduce((sum, line) => {
    const foundItem = availableItems.find((it) => String(it.id) === String(line.itemId));
    if (!foundItem) return sum;
    return sum + (Number(foundItem.unitCost || 0) * (Number(line.quantity) || 0));
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (hasDuplicateItems) {
      setFormError('An item can only appear once per request. Please remove duplicate items.');
      return;
    }

    if (lines.some((l) => !l.itemId || Number(l.quantity) <= 0)) {
      setFormError('Each line must have a selected item and quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        priority,
        justification: justification.trim() || undefined,
        lines: lines.map((l) => ({
          itemId: Number(l.itemId),
          quantity: Number(l.quantity)
        }))
      };

      const res = await apiClient.post('/requests', payload);
      showSuccess(`Purchase request ${res.data.reqNo} submitted successfully`);
      navigate(`/requests/${res.data.id}`);
    } catch (err) {
      const errData = err.response?.data?.error;
      if (errData?.code === 'NO_HOD') {
        setFormError('Your department currently has no assigned Head of Department. A request cannot be submitted until an HoD is appointed.');
      } else if (errData?.code === 'NO_PRINCIPAL') {
        setFormError('There is currently no active Principal account configured in the system to approve this HoD request.');
      } else {
        setFormError(err.message || 'Failed to submit purchase request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingItems) {
    return <LoadingState message="Loading catalog items..." />;
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/requests" className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i>
          <span>Back to Requests</span>
        </Link>
      </div>

      <PageHeader
        title="New Purchase Request"
        description={`Submit a multi-line requisition for ${user?.departmentName || 'your department'}.`}
      />

      <form onSubmit={handleSubmit}>
        {formError && (
          <div className="alert alert-danger d-flex align-items-start gap-2 py-3 px-3 mb-4 shadow-sm" role="alert">
            <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0 mt-1"></i>
            <div>
              <strong>Submission Error</strong>
              <div>{formError}</div>
            </div>
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-8">
            {/* Line Items Card */}
            <Card title="Requested Items">
              {availableItems.length === 0 ? (
                <div className="alert alert-warning mb-0 small">
                  No active inventory items found. An item must exist in the inventory catalog before it can be requested.
                </div>
              ) : (
                <div>
                  <div className="table-responsive">
                    <table className="table align-middle mb-3">
                      <thead>
                        <tr className="text-muted small text-uppercase">
                          <th style={{ width: '45%' }}>Item</th>
                          <th style={{ width: '20%' }}>Quantity</th>
                          <th style={{ width: '20%' }}>Unit Cost</th>
                          <th style={{ width: '15%' }} className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, idx) => {
                          const currentItem = availableItems.find((it) => String(it.id) === String(line.itemId));
                          const isDuplicate = selectedItemIds.filter((id) => id === line.itemId).length > 1;

                          return (
                            <tr key={idx} className={isDuplicate ? 'table-danger' : ''}>
                              <td>
                                <select
                                  id={`req-line-item-${idx}`}
                                  className={`form-select ${isDuplicate ? 'is-invalid' : ''}`}
                                  value={line.itemId}
                                  onChange={(e) => handleLineChange(idx, 'itemId', e.target.value)}
                                  required
                                  disabled={submitting}
                                >
                                  <option value="">Select item...</option>
                                  {availableItems.map((it) => (
                                    <option key={it.id} value={it.id}>
                                      {it.name} (SKU: {it.sku} &bull; {it.unit})
                                    </option>
                                  ))}
                                </select>
                                {isDuplicate && (
                                  <div className="invalid-feedback d-block small">Duplicate item</div>
                                )}
                              </td>
                              <td>
                                <div className="input-group">
                                  <input
                                    id={`req-line-qty-${idx}`}
                                    type="number"
                                    min="1"
                                    className="form-control"
                                    value={line.quantity}
                                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                                    required
                                    disabled={submitting}
                                  />
                                  <span className="input-group-text small text-muted">
                                    {currentItem?.unit || 'Nos'}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="small text-dark fw-medium">
                                  ₹{currentItem ? (Number(currentItem.unitCost) * Number(line.quantity || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                                </div>
                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                  ₹{Number(currentItem?.unitCost || 0).toFixed(2)} / {currentItem?.unit || 'unit'}
                                </div>
                              </td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm py-1 px-2"
                                  onClick={() => handleRemoveLine(idx)}
                                  disabled={lines.length <= 1 || submitting}
                                  title="Remove Line"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <button
                      type="button"
                      id="add-request-line-btn"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      onClick={handleAddLine}
                      disabled={submitting || lines.length >= availableItems.length}
                    >
                      <i className="bi bi-plus-lg"></i>
                      <span>Add Item Line</span>
                    </button>
                    <div className="text-end">
                      <span className="text-muted small me-2">Estimated Total:</span>
                      <span className="fw-bold fs-6 text-dark">
                        ₹{estimatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="col-lg-4">
            {/* Request Meta Card */}
            <Card title="Requisition Details">
              <FormField label="Priority Level" required>
                <select
                  id="req-priority"
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={submitting}
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="HIGH">High / Urgent Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </FormField>

              <FormField
                label="Justification / Purpose"
                hint="Explain academic or departmental need"
              >
                <textarea
                  id="req-justification"
                  className="form-control"
                  rows="4"
                  placeholder="e.g. Required for upcoming Anna University practical examination sessions in the Systems Lab."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={submitting}
                ></textarea>
              </FormField>

              <div className="bg-light p-3 rounded mb-3 small border">
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Requester:</span>
                  <span className="fw-semibold text-dark">{user?.name}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Department:</span>
                  <span className="fw-semibold text-dark">{user?.departmentName || '—'}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">Approval Route:</span>
                  <span className="badge bg-primary">
                    {user?.role === 'HOD' ? 'Principal Approval' : 'HoD Approval'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                id="submit-request-btn"
                className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                disabled={submitting || availableItems.length === 0 || hasDuplicateItems}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-fill"></i>
                    <span>Submit Purchase Request</span>
                  </>
                )}
              </button>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

export default NewRequestPage;
