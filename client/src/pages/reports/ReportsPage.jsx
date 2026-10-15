import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card } from '../../components/common/Card.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';

export function ReportsPage() {
  const { user } = useAuth();
  const { showError } = useToast();

  const isHod = user?.role === 'HOD';
  const canViewInventory = ['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER'].includes(user?.role);
  const canViewProcurement = ['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'HOD'].includes(user?.role);
  const canViewSuppliers = ['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER'].includes(user?.role);

  // Active tab: default to procurement if HoD, else inventory
  const [activeTab, setActiveTab] = useState(isHod ? 'procurement' : 'inventory');

  // 1. Inventory Report State
  const [invData, setInvData] = useState(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState(null);
  const [invCategoryFilter, setInvCategoryFilter] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [categories, setCategories] = useState([]);

  // 2. Procurement Report State
  const [procData, setProcData] = useState(null);
  const [procLoading, setProcLoading] = useState(false);
  const [procError, setProcError] = useState(null);
  const [procFrom, setProcFrom] = useState('');
  const [procTo, setProcTo] = useState('');
  const [procStatus, setProcStatus] = useState('');
  const [procDept, setProcDept] = useState('');
  const [departments, setDepartments] = useState([]);

  // 3. Suppliers Report State
  const [suppData, setSuppData] = useState([]);
  const [suppLoading, setSuppLoading] = useState(false);
  const [suppError, setSuppError] = useState(null);

  // Load masters for filters
  useEffect(() => {
    async function loadFilterMasters() {
      try {
        const [catRes, deptRes] = await Promise.all([
          apiClient.get('/categories?pageSize=100').catch(() => ({ data: { data: [] } })),
          apiClient.get('/departments?pageSize=100').catch(() => ({ data: { data: [] } }))
        ]);
        const catList = catRes.data?.data || (Array.isArray(catRes.data) ? catRes.data : []);
        const deptList = deptRes.data?.data || (Array.isArray(deptRes.data) ? deptRes.data : []);
        setCategories(Array.isArray(catList) ? catList : []);
        setDepartments(Array.isArray(deptList) ? deptList : []);
      } catch {
        // ignore
      }
    }
    loadFilterMasters();
  }, []);

  // Fetch Inventory Report
  const fetchInventory = useCallback(async () => {
    if (!canViewInventory) return;
    setInvLoading(true);
    setInvError(null);
    try {
      const res = await apiClient.get('/reports/inventory', {
        params: {
          categoryId: invCategoryFilter || undefined,
          status: invStatusFilter || undefined
        }
      });
      setInvData(res.data);
    } catch (err) {
      setInvError(err.message || 'Failed to generate inventory valuation report');
    } finally {
      setInvLoading(false);
    }
  }, [canViewInventory, invCategoryFilter, invStatusFilter]);

  // Fetch Procurement Report
  const fetchProcurement = useCallback(async () => {
    if (!canViewProcurement) return;
    setProcLoading(true);
    setProcError(null);
    try {
      const res = await apiClient.get('/reports/procurement', {
        params: {
          from: procFrom || undefined,
          to: procTo || undefined,
          status: procStatus || undefined,
          departmentId: procDept || undefined
        }
      });
      setProcData(res.data);
    } catch (err) {
      setProcError(err.message || 'Failed to generate procurement report');
    } finally {
      setProcLoading(false);
    }
  }, [canViewProcurement, procFrom, procTo, procStatus, procDept]);

  // Fetch Suppliers Report
  const fetchSuppliers = useCallback(async () => {
    if (!canViewSuppliers) return;
    setSuppLoading(true);
    setSuppError(null);
    try {
      const res = await apiClient.get('/reports/suppliers');
      setSuppData(res.data || []);
    } catch (err) {
      setSuppError(err.message || 'Failed to generate suppliers report');
    } finally {
      setSuppLoading(false);
    }
  }, [canViewSuppliers]);

  useEffect(() => {
    if (activeTab === 'inventory') fetchInventory();
    if (activeTab === 'procurement') fetchProcurement();
    if (activeTab === 'suppliers') fetchSuppliers();
  }, [activeTab, fetchInventory, fetchProcurement, fetchSuppliers]);

  // CSV Export Handler
  const handleExportCsv = async (endpoint, params, defaultFilename) => {
    try {
      const res = await apiClient.get(endpoint, {
        params: { ...params, format: 'csv' },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', defaultFilename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showError(err.message || 'Failed to export CSV report');
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive institutional inventory valuation, procurement spend analysis, and supplier performance metrics."
      />

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4 border-bottom">
        {canViewInventory && (
          <li className="nav-item">
            <button
              type="button"
              id="tab-inventory"
              className={`nav-link ${activeTab === 'inventory' ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => setActiveTab('inventory')}
            >
              <i className="bi bi-box-seam me-2"></i>Inventory Valuation
            </button>
          </li>
        )}
        {canViewProcurement && (
          <li className="nav-item">
            <button
              type="button"
              id="tab-procurement"
              className={`nav-link ${activeTab === 'procurement' ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => setActiveTab('procurement')}
            >
              <i className="bi bi-cart3 me-2"></i>Procurement & Spend
            </button>
          </li>
        )}
        {canViewSuppliers && (
          <li className="nav-item">
            <button
              type="button"
              id="tab-suppliers"
              className={`nav-link ${activeTab === 'suppliers' ? 'active fw-semibold' : 'text-muted'}`}
              onClick={() => setActiveTab('suppliers')}
            >
              <i className="bi bi-truck me-2"></i>Supplier Performance
            </button>
          </li>
        )}
      </ul>

      {/* =========================================================================
          TAB 1: INVENTORY VALUATION REPORT
          ========================================================================= */}
      {activeTab === 'inventory' && canViewInventory && (
        <div>
          {/* Filter & Export Toolbar */}
          <div className="card shadow-sm border mb-4 p-3 bg-white">
            <div className="row g-2 align-items-center">
              <div className="col-md-4">
                <select
                  className="form-select form-select-sm"
                  value={invCategoryFilter}
                  onChange={(e) => setInvCategoryFilter(e.target.value)}
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
                  className="form-select form-select-sm"
                  value={invStatusFilter}
                  onChange={(e) => setInvStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW">Low Stock</option>
                  <option value="OUT">Out of Stock</option>
                </select>
              </div>

              <div className="col-md-5 text-end">
                <button
                  type="button"
                  id="export-inventory-csv-btn"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
                  onClick={() =>
                    handleExportCsv(
                      '/reports/inventory',
                      {
                        categoryId: invCategoryFilter || undefined,
                        status: invStatusFilter || undefined
                      },
                      'inventory-valuation-report.csv'
                    )
                  }
                >
                  <i className="bi bi-download"></i>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {invLoading ? (
            <LoadingState message="Generating inventory valuation report..." />
          ) : invError ? (
            <ErrorState title="Error Loading Report" message={invError} onRetry={fetchInventory} />
          ) : (
            <>
              {/* Summary Valuation Banner */}
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="card border-0 bg-primary text-white p-3 shadow-sm">
                    <span className="small text-white-50 text-uppercase fw-semibold">
                      Total Inventory Valuation
                    </span>
                    <h2 className="h3 fw-bold my-1">
                      ₹{Number(invData?.totalValuation || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </h2>
                    <span className="small text-white-50">
                      Based on current unit replacement costs
                    </span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border p-3 shadow-sm bg-white">
                    <span className="small text-muted text-uppercase fw-semibold">
                      Items In Report
                    </span>
                    <h2 className="h3 fw-bold my-1 text-dark">
                      {invData?.totalCount || 0}
                    </h2>
                    <span className="small text-muted">
                      Filtered catalog records
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Valuation Table */}
              <Card title="Valuation Breakdown by Item">
                {!invData?.items || invData.items.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    No items match the selected report criteria.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr className="text-muted small text-uppercase">
                          <th>SKU</th>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th className="text-end">Stock Qty</th>
                          <th className="text-end">Min Level</th>
                          <th>Status</th>
                          <th className="text-end">Unit Cost</th>
                          <th className="text-end">Valuation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invData.items.map((item) => (
                          <tr key={item.id}>
                            <td className="small font-monospace text-secondary">{item.sku}</td>
                            <td className="fw-medium text-dark">{item.name}</td>
                            <td className="small text-muted">{item.categoryName}</td>
                            <td className="text-end fw-semibold">
                              {item.stockQty} {item.unit}
                            </td>
                            <td className="text-end text-muted small">{item.minLevel}</td>
                            <td>
                              <StatusBadge status={item.status} />
                            </td>
                            <td className="text-end text-muted small">
                              ₹{Number(item.unitCost).toFixed(2)}
                            </td>
                            <td className="text-end fw-bold text-dark">
                              ₹{Number(item.valuation).toLocaleString('en-IN', {
                                minimumFractionDigits: 2
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-light">
                          <td colSpan="7" className="text-end fw-semibold text-dark">
                            Total Valuation:
                          </td>
                          <td className="text-end fw-bold fs-6 text-primary">
                            ₹{Number(invData.totalValuation).toLocaleString('en-IN', {
                              minimumFractionDigits: 2
                            })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: PROCUREMENT & SPEND REPORT
          ========================================================================= */}
      {activeTab === 'procurement' && canViewProcurement && (
        <div>
          {/* Filters & CSV */}
          <div className="card shadow-sm border mb-4 p-3 bg-white">
            <div className="row g-2 align-items-center">
              <div className="col-md-2">
                <label className="form-label small text-muted mb-1">From Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={procFrom}
                  onChange={(e) => setProcFrom(e.target.value)}
                />
              </div>

              <div className="col-md-2">
                <label className="form-label small text-muted mb-1">To Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={procTo}
                  onChange={(e) => setProcTo(e.target.value)}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label small text-muted mb-1">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={procStatus}
                  onChange={(e) => setProcStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING_HOD">Pending HoD</option>
                  <option value="PENDING_PRINCIPAL">Pending Principal</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ORDERED">Ordered</option>
                  <option value="RECEIVED">Received</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="RETURNED_BY_PROCUREMENT">Returned</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {!isHod && (
                <div className="col-md-3">
                  <label className="form-label small text-muted mb-1">Department</label>
                  <select
                    className="form-select form-select-sm"
                    value={procDept}
                    onChange={(e) => setProcDept(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={`col-md-${isHod ? '5' : '2'} text-end pt-3`}>
                <button
                  type="button"
                  id="export-procurement-csv-btn"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
                  onClick={() =>
                    handleExportCsv(
                      '/reports/procurement',
                      {
                        from: procFrom || undefined,
                        to: procTo || undefined,
                        status: procStatus || undefined,
                        departmentId: procDept || undefined
                      },
                      'procurement-spend-report.csv'
                    )
                  }
                >
                  <i className="bi bi-download"></i>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {procLoading ? (
            <LoadingState message="Generating procurement report..." />
          ) : procError ? (
            <ErrorState title="Error Loading Report" message={procError} onRetry={fetchProcurement} />
          ) : (
            <>
              {/* Spend Summary */}
              <div className="card bg-success text-white p-3 shadow-sm border-0 mb-4">
                <span className="small text-white-50 text-uppercase fw-semibold">
                  Total Completed Purchase Spend
                </span>
                <h2 className="h3 fw-bold my-1">
                  ₹{Number(procData?.totalSpend || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2
                  })}
                </h2>
                <span className="small text-white-50">
                  Aggregated from all RECEIVED purchase orders
                </span>
              </div>

              <div className="row g-4">
                <div className="col-lg-5">
                  <Card title="Requisition Counts by Status">
                    {!procData?.countsByStatus ||
                    Object.keys(procData.countsByStatus).length === 0 ? (
                      <div className="text-center py-4 text-muted small">
                        No purchase requests found in the selected period.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr className="small text-muted text-uppercase">
                              <th>Status</th>
                              <th className="text-end">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(procData.countsByStatus).map(([status, count]) => (
                              <tr key={status}>
                                <td>
                                  <StatusBadge status={status} />
                                </td>
                                <td className="text-end fw-bold text-dark">{count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="col-lg-7">
                  <Card title="Spend by Month and Department">
                    {!procData?.spendByMonthDepartment ||
                    procData.spendByMonthDepartment.length === 0 ? (
                      <div className="text-center py-4 text-muted small">
                        No completed goods receipts found for the selected filters.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr className="small text-muted text-uppercase">
                              <th>Month</th>
                              <th>Department</th>
                              <th className="text-end">Spend (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {procData.spendByMonthDepartment.map((row, idx) => (
                              <tr key={idx}>
                                <td className="fw-semibold text-primary">{row.month}</td>
                                <td className="text-dark fw-medium">{row.departmentName}</td>
                                <td className="text-end fw-bold text-dark">
                                  ₹{Number(row.totalSpend).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: SUPPLIER PERFORMANCE REPORT
          ========================================================================= */}
      {activeTab === 'suppliers' && canViewSuppliers && (
        <div>
          <div className="d-flex justify-content-end mb-3">
            <button
              type="button"
              id="export-suppliers-csv-btn"
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
              onClick={() =>
                handleExportCsv('/reports/suppliers', {}, 'suppliers-performance-report.csv')
              }
            >
              <i className="bi bi-download"></i>
              <span>Export CSV</span>
            </button>
          </div>

          {suppLoading ? (
            <LoadingState message="Computing supplier performance metrics..." />
          ) : suppError ? (
            <ErrorState title="Error Loading Report" message={suppError} onRetry={fetchSuppliers} />
          ) : (
            <Card title="Supplier Fulfillment & SLA Metrics">
              {suppData.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  No registered suppliers found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr className="small text-muted text-uppercase">
                        <th>Supplier</th>
                        <th>Status</th>
                        <th className="text-end">Total Orders</th>
                        <th className="text-end">Delivered</th>
                        <th className="text-end">On-Time Rate</th>
                        <th className="text-end">Avg Lead Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppData.map((s) => (
                        <tr key={s.supplierId}>
                          <td>
                            <div className="fw-medium text-dark">{s.supplierName}</div>
                            <div className="small text-muted">{s.supplierEmail}</div>
                          </td>
                          <td>
                            <StatusBadge status={s.isActive ? 'ACTIVE' : 'DISABLED'} />
                          </td>
                          <td className="text-end">{s.totalOrders}</td>
                          <td className="text-end fw-semibold text-dark">{s.deliveredCount}</td>
                          <td className="text-end">
                            {s.onTimeRate !== null ? (
                              <span
                                className={`badge ${
                                  s.onTimeRate >= 0.9
                                    ? 'bg-success'
                                    : s.onTimeRate >= 0.7
                                    ? 'bg-warning text-dark'
                                    : 'bg-danger'
                                }`}
                              >
                                {(s.onTimeRate * 100).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-muted small">No deliveries</span>
                            )}
                          </td>
                          <td className="text-end">
                            {s.avgLeadDays !== null ? (
                              <span className="text-dark fw-medium">{s.avgLeadDays} days</span>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
