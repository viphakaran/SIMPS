import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { Modal } from '../../components/common/Modal.jsx';
import { FormField } from '../../components/common/FormField.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function CategoriesPage() {
  const { showSuccess } = useToast();

  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCat, setSelectedCat] = useState(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/categories', {
        params: {
          page,
          pageSize,
          search: search.trim() || undefined
        }
      });
      setCategories(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedCat(null);
    setName('');
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setIsEditing(true);
    setSelectedCat(cat);
    setName(cat.name);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (isEditing) {
        await apiClient.patch(`/categories/${selectedCat.id}`, { name: name.trim() });
        showSuccess(`Category renamed to "${name}"`);
      } else {
        await apiClient.post('/categories', { name: name.trim() });
        showSuccess(`Category "${name}" created`);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      setFormError(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Category Name',
      render: (c) => <span className="fw-semibold text-dark">{c.name}</span>
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      render: (c) => (
        <span className="text-muted small">
          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (c) => (
        <button
          type="button"
          className="btn btn-sm btn-light border py-1 px-2"
          onClick={() => handleOpenEdit(c)}
          title="Rename Category"
        >
          <i className="bi bi-pencil me-1"></i>Rename
        </button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Item category classification and taxonomy."
        action={
          <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={handleOpenCreate}>
            <i className="bi bi-plus-lg"></i>
            <span>Add Category</span>
          </button>
        }
      />

      {error ? (
        <ErrorState title="Failed to load categories" message={error} onRetry={fetchCategories} />
      ) : (
        <DataTable
          columns={columns}
          data={categories}
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
          searchPlaceholder="Search categories..."
          emptyTitle="No categories found"
          emptyMessage="No item categories have been configured yet. Click 'Add Category' to create one."
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? 'Rename Category' : 'Create Category'}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" form="category-form" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleSubmit}>
          {formError && <div className="alert alert-danger py-2 px-3 mb-3 small">{formError}</div>}
          <FormField label="Category Name" required>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Lab Consumables"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
              autoFocus
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

export default CategoriesPage;
