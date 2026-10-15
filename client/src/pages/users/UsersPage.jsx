import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Modal, ConfirmDialog } from '../../components/common/Modal.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'HOD', label: 'Head of Department' },
  { value: 'REQUESTER', label: 'Requester' },
  { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer' },
  { value: 'STORE_MANAGER', label: 'Store Manager' },
  { value: 'SUPPLIER', label: 'Supplier' }
];

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'pending'
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Masters for dropdowns
  const [departments, setDepartments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve'|'disable'|'enable', user }

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'REQUESTER',
    departmentId: '',
    supplierId: ''
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        search: search.trim() || undefined
      };
      if (activeTab === 'pending') {
        params.status = 'PENDING';
      }

      const res = await apiClient.get('/users', { params });
      setUsers(res.data.data || []);
      setTotal(res.data.total || 0);

      // Also get pending count for badge if not on pending tab
      if (activeTab !== 'pending') {
        const pRes = await apiClient.get('/users', { params: { status: 'PENDING', pageSize: 1 } });
        setPendingCount(pRes.data.total || 0);
      } else {
        setPendingCount(res.data.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, search, activeTab]);

  const loadMasters = useCallback(async () => {
    try {
      const [deptRes, supRes] = await Promise.all([
        apiClient.get('/departments?pageSize=100'),
        apiClient.get('/suppliers?pageSize=100')
      ]);
      setDepartments(deptRes.data.data || []);
      setSuppliers(supRes.data.data || []);
    } catch {
      // Masters load non-blocking
    }
  }, []);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'REQUESTER',
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      supplierId: suppliers[0]?.id ? String(suppliers[0].id) : ''
    });
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (targetUser) => {
    setEditingUser(targetUser);
    setFormData({
      name: targetUser.name,
      email: targetUser.email,
      phone: targetUser.phone || '',
      role: targetUser.role,
      departmentId: targetUser.departmentId ? String(targetUser.departmentId) : '',
      supplierId: targetUser.supplierId ? String(targetUser.supplierId) : ''
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        phone: formData.phone.trim() || undefined
      };
      if (formData.role === 'HOD' || formData.role === 'REQUESTER') {
        payload.departmentId = formData.departmentId ? Number(formData.departmentId) : undefined;
      }
      if (formData.role === 'SUPPLIER') {
        payload.supplierId = formData.supplierId ? Number(formData.supplierId) : undefined;
      }

      await apiClient.post('/users', payload);
      showSuccess(`User ${payload.name} created successfully`);
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        role: formData.role,
        phone: formData.phone.trim() || undefined
      };
      if (formData.role === 'HOD' || formData.role === 'REQUESTER') {
        payload.departmentId = formData.departmentId ? Number(formData.departmentId) : null;
      } else {
        payload.departmentId = null;
      }
      if (formData.role === 'SUPPLIER') {
        payload.supplierId = formData.supplierId ? Number(formData.supplierId) : null;
      } else {
        payload.supplierId = null;
      }

      await apiClient.patch(`/users/${editingUser.id}`, payload);
      showSuccess(`User ${payload.name} updated successfully`);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!confirmAction) return;
    const { type, user: targetUser } = confirmAction;
    try {
      if (type === 'approve') {
        await apiClient.post(`/users/${targetUser.id}/approve`);
        showSuccess(`Account for ${targetUser.name} approved`);
      } else if (type === 'disable') {
        await apiClient.post(`/users/${targetUser.id}/disable`);
        showSuccess(`Account for ${targetUser.name} disabled`);
      } else if (type === 'enable') {
        await apiClient.post(`/users/${targetUser.id}/enable`);
        showSuccess(`Account for ${targetUser.name} enabled`);
      }
      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      showError(err.message || `Failed to ${type} user`);
      setConfirmAction(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name / Email',
      render: (u) => (
        <div>
          <div className="fw-semibold text-dark">{u.name}</div>
          <div className="text-muted small">{u.email}</div>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (u) => <span className="badge bg-light text-dark border">{u.role}</span>
    },
    {
      key: 'department',
      label: 'Dept / Supplier',
      render: (u) => {
        if (u.departmentName) return <span className="text-secondary small">{u.departmentName}</span>;
        if (u.supplierName) return <span className="text-secondary small">{u.supplierName}</span>;
        return <span className="text-muted small">—</span>;
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (u) => <StatusBadge status={u.status} />
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (u) => (
        <div className="d-flex justify-content-end gap-1">
          {u.status === 'PENDING' && (
            <button
              type="button"
              className="btn btn-sm btn-success py-1 px-2"
              onClick={() => setConfirmAction({ type: 'approve', user: u })}
              title="Approve Account"
            >
              <i className="bi bi-check-lg me-1"></i>Approve
            </button>
          )}

          {u.status === 'ACTIVE' && u.id !== currentUser?.id && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-1 px-2"
              onClick={() => setConfirmAction({ type: 'disable', user: u })}
              title="Disable Account"
            >
              <i className="bi bi-slash-circle me-1"></i>Disable
            </button>
          )}

          {u.status === 'DISABLED' && (
            <button
              type="button"
              className="btn btn-sm btn-outline-success py-1 px-2"
              onClick={() => setConfirmAction({ type: 'enable', user: u })}
              title="Enable Account"
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i>Enable
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm btn-light border py-1 px-2"
            onClick={() => handleOpenEdit(u)}
            title="Edit User"
          >
            <i className="bi bi-pencil"></i>
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="User Administration"
        description="Manage system accounts, access roles, and pending registration approvals."
        action={
          <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handleOpenCreate}>
            <i className="bi bi-person-plus"></i>
            <span>Add User</span>
          </button>
        }
      />

      {/* Tabs */}
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
            All Accounts
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link d-flex align-items-center gap-2 ${activeTab === 'pending' ? 'active fw-semibold' : 'text-muted'}`}
            onClick={() => {
              setActiveTab('pending');
              setPage(1);
            }}
          >
            <span>Pending Approvals</span>
            {pendingCount > 0 && (
              <span className="badge rounded-pill bg-warning text-dark">{pendingCount}</span>
            )}
          </button>
        </li>
      </ul>

      {error ? (
        <ErrorState title="Failed to load users" message={error} onRetry={fetchUsers} />
      ) : (
        <DataTable
          columns={columns}
          data={users}
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
          searchPlaceholder="Search by name or email..."
          emptyTitle={activeTab === 'pending' ? 'No pending approvals' : 'No users found'}
          emptyMessage={
            activeTab === 'pending'
              ? 'All user accounts are currently reviewed and approved.'
              : 'Try adjusting your search criteria or create a new user account.'
          }
        />
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add User Account"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-user-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  <span>Creating...</span>
                </>
              ) : (
                'Create User'
              )}
            </button>
          </div>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateSubmit}>
          {formError && (
            <div className="alert alert-danger py-2 px-3 mb-3 small">{formError}</div>
          )}

          <FormField label="Full Name" required>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Dr. A. Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Institutional Email" hint="Must use @ritrjpm.ac.in domain" required>
            <input
              type="email"
              className="form-control"
              placeholder="name@ritrjpm.ac.in"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Initial Password" hint="Minimum 8 characters with letter and number" required>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              disabled={submitting}
            />
          </FormField>

          <FormField label="Role" required>
            <select
              className="form-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              disabled={submitting}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormField>

          {(formData.role === 'HOD' || formData.role === 'REQUESTER') && (
            <FormField label="Department" required>
              <select
                className="form-select"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {formData.role === 'SUPPLIER' && (
            <FormField label="Linked Supplier" required>
              <select
                className="form-select"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select supplier vendor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Phone Number" hint="Optional">
            <input
              type="tel"
              className="form-control"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={submitting}
            />
          </FormField>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User Details"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowEditModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-user-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        }
      >
        <form id="edit-user-form" onSubmit={handleEditSubmit}>
          {formError && (
            <div className="alert alert-danger py-2 px-3 mb-3 small">{formError}</div>
          )}

          <FormField label="Email" hint="Email cannot be changed">
            <input type="text" className="form-control bg-light" value={formData.email} disabled />
          </FormField>

          <FormField label="Full Name" required>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={submitting}
            />
          </FormField>

          <FormField label="Role" required>
            <select
              className="form-select"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              disabled={submitting || editingUser?.id === currentUser?.id}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormField>

          {(formData.role === 'HOD' || formData.role === 'REQUESTER') && (
            <FormField label="Department" required>
              <select
                className="form-select"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {formData.role === 'SUPPLIER' && (
            <FormField label="Linked Supplier" required>
              <select
                className="form-select"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                required
                disabled={submitting}
              >
                <option value="">Select supplier vendor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Phone Number" hint="Optional">
            <input
              type="tel"
              className="form-control"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={submitting}
            />
          </FormField>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleExecuteAction}
        title={
          confirmAction?.type === 'approve'
            ? 'Approve Account'
            : confirmAction?.type === 'disable'
            ? 'Disable Account'
            : 'Enable Account'
        }
        message={
          confirmAction?.type === 'approve'
            ? `Are you sure you want to approve ${confirmAction?.user.name} (${confirmAction?.user.email})? They will be notified and granted access.`
            : confirmAction?.type === 'disable'
            ? `Are you sure you want to disable ${confirmAction?.user.name}? They will no longer be able to sign in.`
            : `Are you sure you want to re-enable ${confirmAction?.user.name}?`
        }
        confirmText={
          confirmAction?.type === 'approve'
            ? 'Approve User'
            : confirmAction?.type === 'disable'
            ? 'Disable User'
            : 'Enable User'
        }
        confirmVariant={confirmAction?.type === 'disable' ? 'danger' : 'success'}
      />
    </div>
  );
}

export default UsersPage;
