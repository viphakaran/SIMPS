import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function ItemsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess } = useToast();

  const isStoreManager = user?.role === 'STORE_MANAGER';

  // Items state
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Master options
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form data for Create / Edit
  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    categoryId: '',
    unit: 'Nos',
    minLevel: 5,
    unitCost: 100,
    openingStock: 0,
    isActive: true
  });

  // Issue Stock form
  const [issueForm, setIssueForm] = useState({
    departmentId: '',
    quantity: 1,
    reason: ''
  });

  // Adjust Stock form
  const [adjustForm, setAdjustForm] = useState({
    delta: 0,
    reason: ''
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        status: selectedStatus || undefined,
        active: onlyActive ? 'true' : undefined
      };
      const res = await apiClient.get('/items', { params });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedStatus, onlyActive]);

  const loadMasters = useCallback(async () => {
    try {
      const [catRes, deptRes] = await Promise.all([
        apiClient.get('/categories?pageSize=100'),
        apiClient.get('/departments?pageSize=100')
      ]);
      setCategories(catRes.data.data || []);
      setDepartments(deptRes.data.data || []);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenCreate = () => {
    setItemForm({
      sku: '',
      name: '',
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
      unit: 'Nos',
      minLevel: 5,
      unitCost: 100,
      openingStock: 0,
      isActive: true
    });
    setModalError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (it, e) => {
    e.stopPropagation();
    setActiveItem(it);
    setItemForm({
      sku: it.sku || '',
      name: it.name,
      categoryId: it.categoryId ? String(it.categoryId) : '',
      unit: it.unit || 'Nos',
      minLevel: it.minLevel,
      unitCost: it.unitCost,
      isActive: Boolean(it.isActive)
    });
    setModalError(null);
    setShowEditModal(true);
  };

  const handleOpenIssue = (it, e) => {
    e.stopPropagation();
    setActiveItem(it);
    setIssueForm({
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      quantity: 1,
      reason: ''
    });
    setModalError(null);
    setShowIssueModal(true);
  };

  const handleOpenAdjust = (it, e) => {
    e.stopPropagation();
    setActiveItem(it);
    setAdjustForm({
      delta: 0,
      reason: ''
    });
    setModalError(null);
    setShowAdjustModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/items', {
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        categoryId: Number(itemForm.categoryId),
        unit: itemForm.unit.trim(),
        minLevel: Number(itemForm.minLevel),
        unitCost: Number(itemForm.unitCost),
        openingStock: Number(itemForm.openingStock) || 0
      });
      showSuccess(`Item "${itemForm.name}" created successfully`);
      setShowCreateModal(false);
      fetchItems();
    } catch (err) {
      setModalError(err.message || 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.patch(`/items/${activeItem.id}`, {
        name: itemForm.name.trim(),
        categoryId: Number(itemForm.categoryId),
        unit: itemForm.unit.trim(),
        minLevel: Number(itemForm.minLevel),
        unitCost: Number(itemForm.unitCost),
        isActive: itemForm.isActive
      });
      showSuccess(`Item "${itemForm.name}" updated successfully`);
      setShowEditModal(false);
      fetchItems();
    } catch (err) {
      setModalError(err.message || 'Failed to update item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.post(`/items/${activeItem.id}/issue`, {
        departmentId: Number(issueForm.departmentId),
        quantity: Number(issueForm.quantity),
        reason: issueForm.reason.trim() || undefined
      });
      showSuccess(`Issued ${issueForm.quantity} ${activeItem.unit} of ${activeItem.name}`);
      setShowIssueModal(false);
      fetchItems();
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

      await apiClient.post(`/items/${activeItem.id}/adjust`, {
        delta: Number(adjustForm.delta),
        reason: adjustForm.reason.trim()
      });
      showSuccess(`Stock adjusted for ${activeItem.name}`);
      setShowAdjustModal(false);
      fetchItems();
    } catch (err) {
      setModalError(err.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Item Name',
      render: (it) => (
        <div>
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-semibold text-decoration-none text-primary"
            onClick={() => navigate(`/items/${it.id}`)}
          >
            {it.name}
          </button>
          <div className="text-muted small">Unit: {it.unit}</div>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (it) => <span className="text-secondary small">{it.categoryName || '—'}</span>
    },
    {
      key: 'stock',
      label: 'Current Stock',
      render: (it) => (
        <div>
          <span className="fw-bold fs-6">{it.stockQty}</span>{' '}
          <span className="text-muted small">{it.unit}</span>
          <div className="text-muted small">Min: {it.minLevel}</div>
        </div>
      )
    },
    {
      key: 'unitCost',
      label: 'Unit Cost',
      render: (it) => (
        <span className="small">₹{Number(it.unitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (it) => <StatusBadge status={it.status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (it) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => navigate(`/items/${it.id}`)}
            title="View Details & Movement Log"
          >
            <i className="bi bi-clock-history me-1"></i>History
          </button>

          {isStoreManager && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2"
                onClick={(e) => handleOpenIssue(it, e)}
                disabled={it.stockQty <= 0}
                title="Issue Stock to Department"
              >
                <i className="bi bi-box-arrow-up me-1"></i>Issue
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2"
                onClick={(e) => handleOpenAdjust(it, e)}
                title="Adjust Stock Qty"
              >
                <i className="bi bi-sliders me-1"></i>Adjust
              </button>
              <button
                type="button"
                className="btn btn-sm btn-light border py-1 px-2"
                onClick={(e) => handleOpenEdit(it, e)}
                title="Edit Item"
              >
                <i className="bi bi-pencil"></i>
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Catalog"
        description="Central stock register, item thresholds, and movement audit."
        action={
          isStoreManager && (
            <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handleOpenCreate}>
              <i className="bi bi-plus-lg"></i>
              <span>Add Item</span>
            </button>
          )
        }
      />

      {/* Filter Toolbar */}
      <div className="card shadow-sm border mb-4 p-3 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search items..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="col-md-3">
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <select
              className="form-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>

          <div className="col-md-2">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="activeItemsOnly"
                checked={onlyActive}
                onChange={(e) => {
                  setOnlyActive(e.target.checked);
                  setPage(1);
                }}
              />
              <label className="form-check-label small" htmlFor="activeItemsOnly">
                Active only
              </label>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState title="Failed to load inventory" message={error} onRetry={fetchItems} />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyTitle="No inventory items found"
          emptyMessage="No items match your criteria. Try resetting filters or adding an item."
        />
      )}

      {/* Add Item Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Inventory Item"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </button>
            <button type="submit" form="create-item-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        }
      >
        <form id="create-item-form" onSubmit={handleCreateSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <div className="row">
            <div className="col-md-5">
              <FormField label="SKU / Item Code" hint="Unique SKU code" required>
                <input
                  id="item-sku"
                  type="text"
                  className="form-control"
                  placeholder="e.g. ELEC-ARD-001"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="col-md-7">
              <FormField label="Item Name" required>
                <input
                  id="item-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Arduino Uno R3 Board"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Category" required>
                <select
                  className="form-select"
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  required
                  disabled={submitting}
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Unit of Measure" hint="e.g. Nos, Box, Packet, Kg" required>
                <input
                  type="text"
                  className="form-control"
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <div className="row">
            <div className="col-md-4">
              <FormField label="Minimum Level" hint="Threshold for low alert" required>
                <input
                  id="item-min-level"
                  type="number"
                  min="0"
                  className="form-control"
                  value={itemForm.minLevel}
                  onChange={(e) => setItemForm({ ...itemForm, minLevel: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Unit Cost (₹)" required>
                <input
                  id="item-unit-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={itemForm.unitCost}
                  onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="col-md-4">
              <FormField label="Opening Stock" hint="Initial stock qty">
                <input
                  id="item-opening-stock"
                  type="number"
                  min="0"
                  className="form-control"
                  value={itemForm.openingStock}
                  onChange={(e) => setItemForm({ ...itemForm, openingStock: e.target.value })}
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Item — ${activeItem?.name}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </button>
            <button type="submit" form="edit-item-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <form id="edit-item-form" onSubmit={handleEditSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <FormField label="Item Name" required>
            <input
              type="text"
              className="form-control"
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Category" required>
                <select
                  className="form-select"
                  value={itemForm.categoryId}
                  onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                  required
                  disabled={submitting}
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Unit of Measure" required>
                <input
                  type="text"
                  className="form-control"
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Minimum Level" required>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={itemForm.minLevel}
                  onChange={(e) => setItemForm({ ...itemForm, minLevel: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Unit Cost (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={itemForm.unitCost}
                  onChange={(e) => setItemForm({ ...itemForm, unitCost: e.target.value })}
                  required
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <div className="form-check mt-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="item-active-check"
              checked={itemForm.isActive}
              onChange={(e) => setItemForm({ ...itemForm, isActive: e.target.checked })}
              disabled={submitting}
            />
            <label className="form-check-label small" htmlFor="item-active-check">
              Active item in catalog
            </label>
          </div>
        </form>
      </Modal>

      {/* Issue Stock Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title={`Issue Stock — ${activeItem?.name}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowIssueModal(false)}>
              Cancel
            </button>
            <button type="submit" form="issue-stock-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Issuing...' : 'Issue Stock'}
            </button>
          </div>
        }
      >
        <form id="issue-stock-form" onSubmit={handleIssueSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <div className="bg-light p-3 rounded mb-3 small">
            <div><strong>Available Stock:</strong> {activeItem?.stockQty} {activeItem?.unit}</div>
            <div><strong>Minimum Threshold:</strong> {activeItem?.minLevel} {activeItem?.unit}</div>
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

          <FormField label={`Quantity (${activeItem?.unit})`} required>
            <input
              type="number"
              min="1"
              max={activeItem?.stockQty || 1}
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
              placeholder="e.g. Issued for Semester Lab practicals"
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
        title={`Adjust Stock — ${activeItem?.name}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdjustModal(false)}>
              Cancel
            </button>
            <button type="submit" form="adjust-stock-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adjusting...' : 'Save Adjustment'}
            </button>
          </div>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleAdjustSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <div className="bg-light p-3 rounded mb-3 small">
            <div><strong>Current Stock:</strong> {activeItem?.stockQty} {activeItem?.unit}</div>
            <div><strong>New Stock will be:</strong> {Number(activeItem?.stockQty || 0) + Number(adjustForm.delta || 0)} {activeItem?.unit}</div>
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
              placeholder="e.g. Physical inventory count discrepancy correction"
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

export default ItemsPage;
