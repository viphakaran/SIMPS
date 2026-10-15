import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { Modal, ConfirmDialog } from '../../components/common/Modal.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function DepartmentsPage() {
  const { showSuccess, showError } = useToast();

  const [departments, setDepartments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHodModal, setShowHodModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedHodId, setSelectedHodId] = useState('');

  // Eligible HOD users for assignment
  const [eligibleHods, setEligibleHods] = useState([]);
  const [loadingHods, setLoadingHods] = useState(false);

  // Deactivate confirm
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/departments', {
        params: {
          page,
          pageSize,
          search: search.trim() || undefined
        }
      });
      setDepartments(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleOpenCreate = () => {
    setName('');
    setModalError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (dept) => {
    setSelectedDept(dept);
    setName(dept.name);
    setIsActive(dept.isActive);
    setModalError(null);
    setShowEditModal(true);
  };

  const handleOpenAssignHod = async (dept) => {
    setSelectedDept(dept);
    setSelectedHodId(dept.hodUserId ? String(dept.hodUserId) : '');
    setModalError(null);
    setShowHodModal(true);
    setLoadingHods(true);
    try {
      // Fetch users with role HOD belonging to this department
      const res = await apiClient.get('/users', {
        params: { role: 'HOD', pageSize: 100 }
      });
      const allHods = res.data.data || [];
      const deptHods = allHods.filter((u) => u.departmentId === dept.id && u.status === 'ACTIVE');
      setEligibleHods(deptHods);
    } catch {
      setEligibleHods([]);
    } finally {
      setLoadingHods(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/departments', { name: name.trim() });
      showSuccess(`Department "${name}" created successfully`);
      setShowCreateModal(false);
      fetchDepartments();
    } catch (err) {
      setModalError(err.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.patch(`/departments/${selectedDept.id}`, {
        name: name.trim(),
        isActive
      });
      showSuccess(`Department "${name}" updated successfully`);
      setShowEditModal(false);
      fetchDepartments();
    } catch (err) {
      setModalError(err.message || 'Failed to update department');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignHodSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await apiClient.put(`/departments/${selectedDept.id}/hod`, {
        userId: Number(selectedHodId)
      });
      showSuccess('Head of Department assigned successfully');
      setShowHodModal(false);
      fetchDepartments();
    } catch (err) {
      setModalError(err.message || 'Failed to assign HoD');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!confirmDeactivate) return;
    try {
      await apiClient.patch(`/departments/${confirmDeactivate.id}`, { isActive: false });
      showSuccess(`Department "${confirmDeactivate.name}" deactivated`);
      setConfirmDeactivate(null);
      fetchDepartments();
    } catch (err) {
      showError(err.message || 'Failed to deactivate department');
      setConfirmDeactivate(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Department Name',
      render: (d) => <span className="fw-semibold text-dark">{d.name}</span>
    },
    {
      key: 'hod',
      label: 'Head of Department (HoD)',
      render: (d) =>
        d.hodName ? (
          <span className="badge bg-light text-primary border">{d.hodName}</span>
        ) : (
          <span className="text-muted small fst-italic">Unassigned</span>
        )
    },
    {
      key: 'status',
      label: 'Status',
      render: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'DISABLED'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (d) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => handleOpenAssignHod(d)}
            title="Assign HoD"
          >
            <i className="bi bi-person-badge me-1"></i>HoD
          </button>
          <button
            type="button"
            className="btn btn-sm btn-light border py-1 px-2"
            onClick={() => handleOpenEdit(d)}
            title="Edit Department"
          >
            <i className="bi bi-pencil"></i>
          </button>
          {d.isActive && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger py-1 px-2"
              onClick={() => setConfirmDeactivate(d)}
              title="Deactivate Department"
            >
              <i className="bi bi-slash-circle"></i>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Academic and administrative department directory and HoD assignments."
        action={
          <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handleOpenCreate}>
            <i className="bi bi-plus-lg"></i>
            <span>Add Department</span>
          </button>
        }
      />

      {error ? (
        <ErrorState title="Failed to load departments" message={error} onRetry={fetchDepartments} />
      ) : (
        <DataTable
          columns={columns}
          data={departments}
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
          searchPlaceholder="Search departments..."
          emptyTitle="No departments found"
          emptyMessage="No departments exist yet. Click 'Add Department' to create the first one."
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Department"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </button>
            <button type="submit" form="create-dept-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        }
      >
        <form id="create-dept-form" onSubmit={handleCreateSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <FormField label="Department Name" required>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Mechanical Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
              autoFocus
            />
          </FormField>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Department"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </button>
            <button type="submit" form="edit-dept-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <form id="edit-dept-form" onSubmit={handleEditSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <FormField label="Department Name" required>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </FormField>
          <div className="form-check mt-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="dept-active-check"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={submitting}
            />
            <label className="form-check-label small" htmlFor="dept-active-check">
              Active department
            </label>
          </div>
        </form>
      </Modal>

      {/* Assign HoD Modal */}
      <Modal
        isOpen={showHodModal}
        onClose={() => setShowHodModal(false)}
        title={`Assign HoD — ${selectedDept?.name}`}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowHodModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="assign-hod-form"
              className="btn btn-primary"
              disabled={submitting || !selectedHodId}
            >
              {submitting ? 'Assigning...' : 'Assign HoD'}
            </button>
          </div>
        }
      >
        <form id="assign-hod-form" onSubmit={handleAssignHodSubmit}>
          {modalError && <div className="alert alert-danger py-2 px-3 mb-3 small">{modalError}</div>}
          <FormField
            label="Eligible HoD User"
            hint="Must have role HOD and belong to this department"
            required
          >
            {loadingHods ? (
              <div className="text-muted small">Loading eligible users...</div>
            ) : eligibleHods.length === 0 ? (
              <div className="alert alert-warning py-2 px-3 small mb-0">
                No active users with role <strong>HOD</strong> found for this department. First create or edit a user with role HOD assigned to this department.
              </div>
            ) : (
              <select
                className="form-select"
                value={selectedHodId}
                onChange={(e) => setSelectedHodId(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">Select HoD...</option>
                {eligibleHods.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </form>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={Boolean(confirmDeactivate)}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate Department"
        message={`Are you sure you want to deactivate "${confirmDeactivate?.name}"? New requests will not be allowed for this department.`}
        confirmText="Deactivate"
        confirmVariant="danger"
      />
    </div>
  );
}

export default DepartmentsPage;
