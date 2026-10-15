import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/client.js';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card, StatCard } from '../../components/common/Card.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';

export function SupplierDetailPage() {
  const { id } = useParams();

  const [supplier, setSupplier] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSupplierData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, perfRes] = await Promise.all([
        apiClient.get(`/suppliers/${id}`),
        apiClient.get(`/suppliers/${id}/performance`)
      ]);
      setSupplier(supRes.data);
      setPerformance(perfRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSupplierData();
  }, [loadSupplierData]);

  if (loading) {
    return <LoadingState message="Loading supplier profile..." />;
  }

  if (error || !supplier) {
    return (
      <ErrorState
        title="Supplier Not Found"
        message={error || 'Unable to load supplier details.'}
        onRetry={loadSupplierData}
      />
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/suppliers" className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i>
          <span>Back to Suppliers</span>
        </Link>
      </div>

      <PageHeader
        title={supplier.name}
        description={`Vendor profile and procurement track record.`}
        action={<StatusBadge status={supplier.isActive ? 'ACTIVE' : 'DISABLED'} />}
      />

      <div className="row g-4 mb-4">
        {/* Contact Info Card */}
        <div className="col-lg-4">
          <Card title="Vendor Information">
            <div className="d-flex flex-column gap-3 small">
              <div>
                <span className="text-muted d-block mb-1">Company Name</span>
                <span className="fw-semibold text-dark">{supplier.name}</span>
              </div>
              <div>
                <span className="text-muted d-block mb-1">Contact Person</span>
                <span className="text-dark">{supplier.contactName || '—'}</span>
              </div>
              <div>
                <span className="text-muted d-block mb-1">Email Address</span>
                <span className="text-dark">{supplier.email || '—'}</span>
              </div>
              <div>
                <span className="text-muted d-block mb-1">Phone Number</span>
                <span className="text-dark">{supplier.phone || '—'}</span>
              </div>
              <div>
                <span className="text-muted d-block mb-1">Postal / Billing Address</span>
                <span className="text-dark">{supplier.address || '—'}</span>
              </div>
              <div>
                <span className="text-muted d-block mb-1">Registered Since</span>
                <span className="text-dark">
                  {supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Performance Metrics Panel */}
        <div className="col-lg-8">
          <Card title="Fulfillment & Performance">
            <p className="text-muted small mb-4">
              Real metrics calculated across all purchase orders fulfilled by this supplier. Per institutional policy,
              null values represent lack of deliveries rather than failure.
            </p>

            <div className="row g-3">
              <div className="col-sm-6">
                <StatCard
                  title="Total Orders Placed"
                  value={performance?.totalOrders ?? 0}
                  icon="bi-bag-check"
                  color="primary"
                />
              </div>

              <div className="col-sm-6">
                <StatCard
                  title="Delivered Orders"
                  value={performance?.deliveredCount ?? 0}
                  icon="bi-box-seam"
                  color="info"
                />
              </div>

              <div className="col-sm-6">
                <div className="card shadow-sm border p-3">
                  <div className="text-muted small fw-semibold text-uppercase mb-2">On-Time Delivery Rate</div>
                  <div className="h3 fw-bold mb-1 text-dark">
                    {performance?.onTimeRate !== null && performance?.onTimeRate !== undefined ? (
                      `${Math.round(performance.onTimeRate * 100)}%`
                    ) : (
                      <span className="text-muted fs-5 fw-normal">No data yet</span>
                    )}
                  </div>
                  <div className="text-muted small">
                    {performance?.onTimeRate !== null && performance?.onTimeRate !== undefined
                      ? 'Delivered on or before expected date'
                      : 'Requires at least one delivery with expected date'}
                  </div>
                </div>
              </div>

              <div className="col-sm-6">
                <div className="card shadow-sm border p-3">
                  <div className="text-muted small fw-semibold text-uppercase mb-2">Average Lead Time</div>
                  <div className="h3 fw-bold mb-1 text-dark">
                    {performance?.avgLeadDays !== null && performance?.avgLeadDays !== undefined ? (
                      `${Number(performance.avgLeadDays).toFixed(1)} days`
                    ) : (
                      <span className="text-muted fs-5 fw-normal">No data yet</span>
                    )}
                  </div>
                  <div className="text-muted small">
                    {performance?.avgLeadDays !== null && performance?.avgLeadDays !== undefined
                      ? 'From PO placement to physical delivery'
                      : 'Requires at least one delivered purchase order'}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SupplierDetailPage;
