import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered (Awaiting Receipt)' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        overdue: overdueOnly ? 'true' : undefined
      };
      const res = await apiClient.get('/orders', { params });
      setOrders(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, overdueOnly]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const isOverdue = (order) => {
    if (!order.expectedDate) return false;
    if (['DELIVERED', 'RECEIVED', 'CANCELLED'].includes(order.status)) return false;
    const exp = new Date(order.expectedDate).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return exp < today;
  };

  const columns = [
    {
      key: 'poNo',
      label: 'PO Number',
      render: (o) => (
        <div>
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-semibold text-decoration-none text-primary font-monospace"
            onClick={() => navigate(`/orders/${o.id}`)}
          >
            {o.poNo}
          </button>
          {isOverdue(o) && (
            <span className="badge bg-danger ms-2 py-0 px-1" style={{ fontSize: '10px' }}>
              OVERDUE
            </span>
          )}
        </div>
      )
    },
    {
      key: 'supplier',
      label: 'Supplier',
      render: (o) => <span className="small text-dark fw-medium">{o.supplierName || '—'}</span>
    },
    {
      key: 'itemsCount',
      label: 'Items',
      render: (o) => <span className="badge bg-light text-muted border">{o.itemCount || 0} lines</span>
    },
    {
      key: 'totalAmount',
      label: 'Amount',
      className: 'text-end',
      render: (o) => (
        <span className="fw-medium text-dark">
          ₹{Number(o.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (o) => <StatusBadge status={o.status} />
    },
    {
      key: 'expectedDate',
      label: 'Expected By',
      render: (o) => (
        <span className={`small ${isOverdue(o) ? 'text-danger fw-semibold' : 'text-muted'}`}>
          {o.expectedDate ? new Date(o.expectedDate).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      key: 'deliveredDate',
      label: 'Delivered',
      render: (o) => (
        <span className="small text-muted">
          {o.deliveredDate ? new Date(o.deliveredDate).toLocaleDateString() : '—'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'text-end',
      render: (o) => (
        <div className="d-flex justify-content-end gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => navigate(`/orders/${o.id}`)}
          >
            <i className="bi bi-eye me-1"></i>View
          </button>
          {user?.role === 'STORE_MANAGER' && o.status === 'DELIVERED' && (
            <button
              type="button"
              className="btn btn-sm btn-success py-1 px-2 text-white"
              onClick={() => navigate(`/orders/${o.id}`)}
              title="Receive Goods"
            >
              <i className="bi bi-box-seam me-1"></i>Receive
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description={
          user?.role === 'SUPPLIER'
            ? 'Track purchase orders assigned to your company and update delivery fulfillment milestones.'
            : 'Track college purchase orders, supplier fulfillment pipelines, and incoming stock receipts.'
        }
      />

      {/* Filter Toolbar */}
      <div className="card shadow-sm border mb-4 p-3 bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by PO number or supplier name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="col-md-4">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <div className="form-check form-switch pt-1">
              <input
                className="form-check-input"
                type="checkbox"
                id="overdue-filter-toggle"
                checked={overdueOnly}
                onChange={(e) => {
                  setOverdueOnly(e.target.checked);
                  setPage(1);
                }}
              />
              <label className="form-check-label small fw-medium text-dark" htmlFor="overdue-filter-toggle">
                Show Overdue Only
              </label>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Failed to load orders"
          message={error}
          onRetry={fetchOrders}
        />
      ) : (
        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          emptyTitle="No purchase orders found"
          emptyMessage="No purchase orders match your filter criteria."
        />
      )}
    </div>
  );
}

export default OrdersPage;
