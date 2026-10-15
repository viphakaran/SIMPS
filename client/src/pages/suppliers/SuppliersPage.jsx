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

export function SuppliersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess } = useToast();

  const canManage = ['ADMIN', 'PROCUREMENT_OFFICER'].includes(user?.role);

  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    isActive: true
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/suppliers', {
        params: {
          page,
          pageSize,
          search: search.trim() || undefined
        }
      });
      setSuppliers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedSupplier(null);
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      isActive: true
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (sup, e) => {
    e.stopPropagation();
    setIsEditing(true);
    setSelectedSupplier(sup);
    setFormData({
      name: sup.name,
      contactName: sup.contactName || '',
      email: sup.email || '',
      phone: sup.phone || '',
      address: sup.address || '',
      isActive: Boolean(sup.isActive)
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        contactName: formData.contactName.trim() || undefined,
        email: formData.email.trim().toLowerCase() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined
      };

      if (isEditing) {
        payload.isActive = formData.isActive;
        await apiClient.patch(`/suppliers/${selectedSupplier.id}`, payload);
        showSuccess(`Supplier "${payload.name}" updated`);
      } else {
        await apiClient.post('/suppliers', payload);
        showSuccess(`Supplier "${payload.name}" registered`);
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      setFormError(err.message || 'Failed to save supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Supplier Name',
      render: (s) => (
        <div>
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-semibold text-decoration-none text-primary"
            onClick={() => navigate(`/suppliers/${s.id}`)}
          >
            {s.name}
          </button>
          {s.contactName && <div className="text-muted small">Contact: {s.contactName}</div>}
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email / Phone',
      render: (s) => (
        <div className="small">
          {s.email && <div>{s.email}</div>}
          {s.phone && <div className="text-muted">{s.phone}</div>}
          {!s.email && !s.phone && <span className="text-muted">—</span>}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (s) => <StatusBadge status={s.isActive ? 'ACTIVE' : 'DISABLED'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (s) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => navigate(`/suppliers/${s.id}`)}
            title="View Profile & Performance"
          >
            <i className="bi bi-graph-up me-1"></i>Profile
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-sm btn-light border py-1 px-2"
              onClick={(e) => handleOpenEdit(s, e)}
              title="Edit Supplier"
            >
              <i className="bi bi-pencil"></i>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Approved vendor directory, contact details, and performance records."
        action={
          canManage && (
            <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handleOpenCreate}>
              <i className="bi bi-plus-lg"></i>
              <span>Add Supplier</span>
            </button>
          )
        }
      />

      {error ? (
        <ErrorState title="Failed to load suppliers" message={error} onRetry={fetchSuppliers} />
      ) : (
        <DataTable
          columns={columns}
          data={suppliers}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(q) => {
            setSearch(q);
            setPage(1);
          }}
          searchPlaceholder="Search suppliers..."
          emptyTitle="No suppliers found"
          emptyMessage="No vendors registered yet. Click 'Add Supplier' to create an approved vendor."
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? 'Edit Supplier' : 'Register Supplier'}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" form="supplier-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Register Supplier'}
            </button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit}>
          {formError && <div className="alert alert-danger py-2 px-3 mb-3 small">{formError}</div>}
          <FormField label="Supplier Company Name" required>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Acme Scientific Instruments Ltd."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Contact Person Name" hint="Optional">
            <input
              type="text"
              className="form-control"
              placeholder="e.g. S. Venkatesh"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              disabled={submitting}
            />
          </FormField>

          <div className="row">
            <div className="col-md-6">
              <FormField label="Email" hint="Vendor contact email">
                <input
                  type="email"
                  className="form-control"
                  placeholder="vendor@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="col-md-6">
              <FormField label="Phone" hint="Optional phone / mobile">
                <input
                  type="tel"
                  className="form-control"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <FormField label="Address" hint="Postal / Billing address">
            <textarea
              className="form-control"
              rows="2"
              placeholder="Street, City, Postal Code"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={submitting}
            ></textarea>
          </FormField>

          {isEditing && (
            <div className="form-check mt-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="supplier-active-check"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={submitting}
              />
              <label className="form-check-label small" htmlFor="supplier-active-check">
                Active supplier
              </label>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

export default SuppliersPage;
