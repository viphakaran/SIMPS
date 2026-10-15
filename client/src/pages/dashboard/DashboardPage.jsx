import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import apiClient from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Card, StatCard } from '../../components/common/Card.jsx';
import { StatusBadge } from '../../components/common/StatusBadge.jsx';
import { LoadingState, ErrorState } from '../../components/common/LoadingState.jsx';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/reports/dashboard');
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return <LoadingState message="Loading dashboard metrics..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Dashboard Error"
        message={error || 'Unable to retrieve dashboard information'}
        onRetry={fetchDashboard}
      />
    );
  }

  const renderEmptyChart = (message = 'No data available to display chart') => (
    <div
      className="d-flex flex-column align-items-center justify-content-center text-muted"
      style={{ height: '260px' }}
    >
      <i className="bi bi-bar-chart fs-2 mb-2 text-secondary opacity-50"></i>
      <span className="small">{message}</span>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name}`}
        description={`Role: ${user?.role} ${user?.departmentName ? `• ${user?.departmentName}` : ''} • Real-time operational summary.`}
      />

      {/* =========================================================================
          STORE MANAGER DASHBOARD
          ========================================================================= */}
      {user?.role === 'STORE_MANAGER' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Total Items"
                value={data.items?.total ?? 0}
                icon="bi-box"
                subtext="Active inventory catalog"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Low Stock"
                value={data.items?.low ?? 0}
                icon="bi-exclamation-triangle text-warning"
                subtext="At or below reorder level"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Out of Stock"
                value={data.items?.out ?? 0}
                icon="bi-x-circle text-danger"
                subtext="Zero balance on hand"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Awaiting Receipt"
                value={data.posAwaitingReceipt ?? 0}
                icon="bi-truck text-info"
                subtext="Delivered POs to verify"
              />
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <Card title="Inventory Stock Health">
                {data.items?.total === 0 ? (
                  renderEmptyChart('No inventory items registered in catalog')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'In Stock', value: data.items?.inStock || 0 },
                            { name: 'Low Stock', value: data.items?.low || 0 },
                            { name: 'Out of Stock', value: data.items?.out || 0 }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          dataKey="value"
                          label={({ name, percent }) =>
                            percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                          }
                        >
                          <Cell fill="#16A34A" />
                          <Cell fill="#D97706" />
                          <Cell fill="#DC2626" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6">
              <Card
                title="Low or Depleted Stock"
                headerAction={
                  <Link to="/reorder" className="small text-decoration-none">
                    View Reorder Suggestions &rarr;
                  </Link>
                }
              >
                {!data.lowStockList || data.lowStockList.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    All inventory items are currently above their reorder thresholds.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="small text-muted text-uppercase">
                          <th>Item</th>
                          <th>SKU</th>
                          <th className="text-end">Qty</th>
                          <th className="text-end">Min</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.lowStockList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="fw-medium text-dark">{item.name}</td>
                            <td className="small text-secondary font-monospace">{item.sku}</td>
                            <td className="text-end fw-bold">{item.stock_qty}</td>
                            <td className="text-end text-muted">{item.min_level}</td>
                            <td>
                              <StatusBadge status={item.status} />
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

          <div className="row g-4">
            <div className="col-12">
              <Card
                title="Recent Stock Movements"
                headerAction={
                  <Link to="/items" className="small text-decoration-none">
                    View All Items &rarr;
                  </Link>
                }
              >
                {!data.recentMovements || data.recentMovements.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    No stock movements recorded yet.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="small text-muted text-uppercase">
                          <th>Time</th>
                          <th>Item</th>
                          <th>Type</th>
                          <th className="text-end">Quantity</th>
                          <th className="text-end">Balance After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentMovements.map((m) => (
                          <tr key={m.id}>
                            <td className="small text-muted">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="fw-medium text-dark">
                              {m.itemName}{' '}
                              <span className="small text-muted font-monospace">({m.sku})</span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  m.type === 'RECEIPT'
                                    ? 'bg-success'
                                    : m.type === 'ISSUE'
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td
                              className={`text-end fw-semibold ${
                                m.quantity > 0 ? 'text-success' : 'text-danger'
                              }`}
                            >
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </td>
                            <td className="text-end fw-bold text-dark">{m.balanceAfter}</td>
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

      {/* =========================================================================
          PROCUREMENT OFFICER DASHBOARD
          ========================================================================= */}
      {user?.role === 'PROCUREMENT_OFFICER' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Approved Waiting"
                value={data.approvedRequestsWaiting ?? 0}
                icon="bi-hourglass-split text-primary"
                subtext="Requisitions ready for POs"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Active Orders"
                value={data.openOrders ?? 0}
                icon="bi-cart-check text-info"
                subtext="Placed, Confirmed, Shipped"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Overdue Orders"
                value={data.overdueOrders ?? 0}
                icon="bi-clock-history text-danger"
                subtext="Passed expected date"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Reorder Alerts"
                value={data.reorderSuggestionsCount ?? 0}
                icon="bi-lightning-charge text-warning"
                subtext="Items needing replenishment"
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <Card title="Procurement Workload Pipeline">
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={[
                        { name: 'Approved Reqs', count: data.approvedRequestsWaiting || 0 },
                        { name: 'Active POs', count: data.openOrders || 0 },
                        { name: 'Overdue POs', count: data.overdueOrders || 0 },
                        { name: 'Reorder Items', count: data.reorderSuggestionsCount || 0 }
                      ]}
                    >
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="col-lg-6">
              <Card title="Quick Procurement Actions">
                <div className="d-flex flex-column gap-3 py-2">
                  <div className="p-3 border rounded d-flex justify-content-between align-items-center">
                    <div>
                      <h3 className="h6 mb-1 text-dark fw-semibold">Process Approved Requests</h3>
                      <p className="text-muted small mb-0">
                        {data.approvedRequestsWaiting || 0} requisition(s) ready for supplier assignment.
                      </p>
                    </div>
                    <Link to="/procurement" className="btn btn-sm btn-primary">
                      Open Queue
                    </Link>
                  </div>

                  <div className="p-3 border rounded d-flex justify-content-between align-items-center">
                    <div>
                      <h3 className="h6 mb-1 text-dark fw-semibold">Review Reorder Suggestions</h3>
                      <p className="text-muted small mb-0">
                        {data.reorderSuggestionsCount || 0} inventory items are below minimum or buffer stock.
                      </p>
                    </div>
                    <Link to="/reorder" className="btn btn-sm btn-outline-primary">
                      Check Suggestions
                    </Link>
                  </div>

                  <div className="p-3 border rounded d-flex justify-content-between align-items-center">
                    <div>
                      <h3 className="h6 mb-1 text-dark fw-semibold">Track Purchase Orders</h3>
                      <p className="text-muted small mb-0">
                        Monitor active delivery pipelines and overdue orders.
                      </p>
                    </div>
                    <Link to="/orders" className="btn btn-sm btn-outline-primary">
                      View Orders
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          HOD DASHBOARD
          ========================================================================= */}
      {user?.role === 'HOD' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-6">
              <StatCard
                title="Pending Department Approvals"
                value={data.pendingApprovals ?? 0}
                icon="bi-check2-circle text-primary"
                subtext="Awaiting your HoD review"
              />
            </div>
            <div className="col-sm-6 col-lg-6">
              <StatCard
                title="Total Requisitions"
                value={Object.values(data.requestsByStatus || {}).reduce((a, b) => a + b, 0)}
                icon="bi-file-earmark-text text-info"
                subtext="Department history"
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-7">
              <Card title="Department Requests by Status">
                {Object.keys(data.requestsByStatus || {}).length === 0 ? (
                  renderEmptyChart('No requisitions recorded for this department yet')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={Object.entries(data.requestsByStatus).map(([status, count]) => ({
                          status,
                          count
                        }))}
                      >
                        <XAxis dataKey="status" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-5">
              <Card title="Approvals Action Center">
                <div className="p-3 border rounded mb-3">
                  <h3 className="h6 mb-1 text-dark fw-semibold">Department Approvals Queue</h3>
                  <p className="text-muted small mb-3">
                    {data.pendingApprovals > 0
                      ? `You have ${data.pendingApprovals} request(s) awaiting your decision.`
                      : 'Your approvals queue is clear.'}
                  </p>
                  <Link to="/approvals" className="btn btn-primary btn-sm w-100">
                    Go to Approvals Queue
                  </Link>
                </div>

                <div className="p-3 border rounded">
                  <h3 className="h6 mb-1 text-dark fw-semibold">Submit New Requisition</h3>
                  <p className="text-muted small mb-3">
                    Need departmental equipment or consumables? Raise a purchase request.
                  </p>
                  <Link to="/requests/new" className="btn btn-outline-primary btn-sm w-100">
                    Create Requisition
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          PRINCIPAL DASHBOARD
          ========================================================================= */}
      {user?.role === 'PRINCIPAL' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Principal Queue"
                value={data.pendingApprovals ?? 0}
                icon="bi-award text-primary"
                subtext="HoD requisitions pending"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Active POs"
                value={data.openOrders ?? 0}
                icon="bi-box-seam text-info"
                subtext="Orders in fulfillment"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="College Spend"
                value={`₹${Number(data.totalSpend || 0).toLocaleString('en-IN', {
                  maximumFractionDigits: 0
                })}`}
                icon="bi-cash-coin text-success"
                subtext="Total completed deliveries"
              />
            </div>
            <div className="col-sm-6 col-lg-3">
              <StatCard
                title="Total Requests"
                value={Object.values(data.requestsByStatus || {}).reduce((a, b) => a + b, 0)}
                icon="bi-file-text text-secondary"
                subtext="All campus departments"
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <Card title="College-wide Requests by Status">
                {Object.keys(data.requestsByStatus || {}).length === 0 ? (
                  renderEmptyChart('No requisitions recorded in the institution yet')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={Object.entries(data.requestsByStatus).map(([status, count]) => ({
                          status,
                          count
                        }))}
                      >
                        <XAxis dataKey="status" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6">
              <Card title="Procurement Spend by Month">
                {!data.spendByMonthDepartment || data.spendByMonthDepartment.length === 0 ? (
                  renderEmptyChart('No completed goods receipts recorded yet')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={data.spendByMonthDepartment}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                        <Bar dataKey="totalSpend" fill="#16A34A" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          REQUESTER DASHBOARD
          ========================================================================= */}
      {user?.role === 'REQUESTER' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-4">
              <StatCard
                title="Pending Decision"
                value={
                  (data.requestsByStatus?.PENDING_HOD || 0) +
                  (data.requestsByStatus?.PENDING_PRINCIPAL || 0)
                }
                icon="bi-clock text-warning"
                subtext="Awaiting HoD approval"
              />
            </div>
            <div className="col-sm-6 col-lg-4">
              <StatCard
                title="Approved & Ordered"
                value={
                  (data.requestsByStatus?.APPROVED || 0) + (data.requestsByStatus?.ORDERED || 0)
                }
                icon="bi-cart-check text-primary"
                subtext="In procurement pipeline"
              />
            </div>
            <div className="col-sm-6 col-lg-4">
              <StatCard
                title="Received"
                value={data.requestsByStatus?.RECEIVED || 0}
                icon="bi-check2-circle text-success"
                subtext="Delivered & stock credited"
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <Card title="My Requisitions Status Breakdown">
                {Object.keys(data.requestsByStatus || {}).length === 0 ? (
                  renderEmptyChart('You have not raised any purchase requests yet')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={Object.entries(data.requestsByStatus).map(([status, count]) => ({
                          status,
                          count
                        }))}
                      >
                        <XAxis dataKey="status" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6">
              <Card
                title="My Recent Requisitions"
                headerAction={
                  <Link to="/requests" className="small text-decoration-none">
                    View All &rarr;
                  </Link>
                }
              >
                {!data.recentRequests || data.recentRequests.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    No requests found.{' '}
                    <Link to="/requests/new">Create your first request</Link>.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="small text-muted text-uppercase">
                          <th>Request No</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th className="text-end">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentRequests.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                type="button"
                                className="btn btn-link p-0 small fw-semibold text-decoration-none text-primary"
                                onClick={() => navigate(`/requests/${r.id}`)}
                              >
                                {r.reqNo}
                              </button>
                            </td>
                            <td>
                              <span className="small">{r.priority}</span>
                            </td>
                            <td>
                              <StatusBadge status={r.status} />
                            </td>
                            <td className="text-end small text-muted">
                              {new Date(r.createdAt).toLocaleDateString()}
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

      {/* =========================================================================
          SUPPLIER DASHBOARD
          ========================================================================= */}
      {user?.role === 'SUPPLIER' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-6">
              <StatCard
                title="Open Orders"
                value={Object.values(data.openOrdersByStatus || {}).reduce((a, b) => a + b, 0)}
                icon="bi-box-seam text-primary"
                subtext="Placed, Confirmed, Shipped"
              />
            </div>
            <div className="col-sm-6 col-lg-6">
              <StatCard
                title="Overdue Deliveries"
                value={data.overdueDeliveries ?? 0}
                icon="bi-exclamation-circle text-danger"
                subtext="Past agreed expected date"
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <Card title="Open Orders Pipeline">
                {Object.keys(data.openOrdersByStatus || {}).length === 0 ? (
                  renderEmptyChart('No active purchase orders currently pending delivery')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={Object.entries(data.openOrdersByStatus).map(([status, count]) => ({
                          status,
                          count
                        }))}
                      >
                        <XAxis dataKey="status" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6">
              <Card title="Fulfillment Center">
                <div className="p-3 border rounded mb-3">
                  <h3 className="h6 mb-1 text-dark fw-semibold">View Assigned Orders</h3>
                  <p className="text-muted small mb-3">
                    Confirm incoming orders, submit shipping details, and record deliveries.
                  </p>
                  <Link to="/orders" className="btn btn-primary btn-sm w-100">
                    Open Orders List
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          ADMIN DASHBOARD
          ========================================================================= */}
      {user?.role === 'ADMIN' && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-4">
              <StatCard
                title="Pending Accounts"
                value={data.pendingAccounts ?? 0}
                icon="bi-person-check text-warning"
                subtext="Self-registered users to review"
              />
            </div>
            <div className="col-sm-6 col-lg-4">
              <StatCard
                title="Total Users"
                value={Object.values(data.usersByRole || {}).reduce((a, b) => a + b, 0)}
                icon="bi-people text-primary"
                subtext="Registered across all roles"
              />
            </div>
            <div className="col-sm-6 col-lg-4">
              <StatCard
                title="Depts Without HoD"
                value={data.departmentsWithoutHod?.length ?? 0}
                icon="bi-building-exclamation text-danger"
                subtext="Requires HoD appointment"
              />
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <Card title="User Distribution by Role">
                {Object.keys(data.usersByRole || {}).length === 0 ? (
                  renderEmptyChart('No users registered in system')
                ) : (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={Object.entries(data.usersByRole).map(([role, count]) => ({
                          role,
                          count
                        }))}
                      >
                        <XAxis dataKey="role" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="col-lg-6">
              <Card
                title="Departments Lacking HoD Assignment"
                headerAction={
                  <Link to="/departments" className="small text-decoration-none">
                    Manage Departments &rarr;
                  </Link>
                }
              >
                {!data.departmentsWithoutHod || data.departmentsWithoutHod.length === 0 ? (
                  <div className="text-center py-4 text-muted small">
                    All active departments currently have an assigned Head of Department.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="small text-muted text-uppercase">
                          <th>Department Name</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.departmentsWithoutHod.map((dept) => (
                          <tr key={dept.id}>
                            <td className="fw-medium text-dark">{dept.name}</td>
                            <td className="text-end">
                              <Link
                                to="/departments"
                                className="btn btn-outline-primary btn-sm py-0 px-2"
                              >
                                Assign HoD
                              </Link>
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
  );
}

export default DashboardPage;
