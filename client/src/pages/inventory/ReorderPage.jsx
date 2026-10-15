import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { DataTable } from '../../components/common/DataTable.jsx';
import { ErrorState } from '../../components/common/LoadingState.jsx';

export function ReorderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStoreManager = user?.role === 'STORE_MANAGER';

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/items/reorder-suggestions');
      setSuggestions(res.data.data || res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to calculate reorder suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const columns = [
    {
      key: 'name',
      label: 'Item / Category',
      render: (r) => (
        <div>
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-semibold text-decoration-none text-primary"
            onClick={() => navigate(`/items/${r.id}`)}
          >
            {r.name}
          </button>
          <div className="text-muted small">{r.categoryName || 'General'} &bull; {r.unit}</div>
        </div>
      )
    },
    {
      key: 'stockQty',
      label: 'Current Stock',
      render: (r) => (
        <div>
          <span className="fw-semibold text-dark">{r.stockQty}</span>{' '}
          <span className="text-muted small">{r.unit}</span>
          <div className="text-muted small">Min: {r.minLevel}</div>
        </div>
      )
    },
    {
      key: 'onOrder',
      label: 'On Order',
      render: (r) => (
        <div>
          <span className="fw-semibold text-dark">{r.onOrder}</span>{' '}
          <span className="text-muted small">{r.unit}</span>
          <div className="text-muted small">Active POs</div>
        </div>
      )
    },
    {
      key: 'avgDaily',
      label: 'Avg Daily Usage',
      render: (r) =>
        r.insufficientData ? (
          <span className="badge bg-light text-muted border">Not enough usage data</span>
        ) : (
          <div>
            <span className="fw-semibold text-dark">{Number(r.avgDaily).toFixed(2)}</span>{' '}
            <span className="text-muted small">{r.unit}/day</span>
            <div className="text-muted small">Last 30 days</div>
          </div>
        )
    },
    {
      key: 'daysOfCover',
      label: 'Days of Cover',
      render: (r) =>
        r.insufficientData || r.daysOfCover === null || r.daysOfCover === undefined ? (
          <span className="text-muted small">—</span>
        ) : (
          <div>
            <span className={`fw-semibold ${Number(r.daysOfCover) < 14 ? 'text-warning' : 'text-dark'}`}>
              {Math.round(r.daysOfCover)} days
            </span>
          </div>
        )
    },
    {
      key: 'suggestedQty',
      label: 'Suggested Qty',
      render: (r) => (
        <div>
          <span className="badge bg-primary fs-6 px-2 py-1">
            {r.suggestedQty} {r.unit}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Action',
      className: 'text-end',
      render: (r) =>
        isStoreManager && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary py-1 px-2"
            onClick={() => navigate('/requests/new', { state: { prefillItemId: r.id, prefillQty: r.suggestedQty } })}
            title="Create Purchase Request"
          >
            <i className="bi bi-file-earmark-plus me-1"></i>Create Req
          </button>
        )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Reorder Suggestions"
        description="Automated stock replenishment calculations based on safety stock thresholds and 30-day consumption rates."
        action={
          <button
            type="button"
            className="btn btn-outline-secondary d-flex align-items-center gap-2"
            onClick={fetchSuggestions}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh</span>
          </button>
        }
      />

      <div className="alert alert-info py-2 px-3 mb-3 small d-flex align-items-center gap-2">
        <i className="bi bi-info-circle-fill fs-5 flex-shrink-0"></i>
        <div>
          Calculated using: <code>suggested_qty = max(0, ceil(avg_daily * 30) - current_stock - on_order)</code>. Items with no issue activity in the last 30 days are flagged with &quot;Not enough usage data&quot;.
        </div>
      </div>

      {error ? (
        <ErrorState title="Failed to calculate suggestions" message={error} onRetry={fetchSuggestions} />
      ) : (
        <DataTable
          columns={columns}
          data={suggestions}
          loading={loading}
          total={suggestions.length}
          pageSize={50}
          emptyTitle="No items currently require reordering"
          emptyMessage="All items have sufficient stock levels above their minimum thresholds and days-of-cover targets."
        />
      )}
    </div>
  );
}

export default ReorderPage;
