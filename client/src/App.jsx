import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

import { ProtectedRoute } from './components/guards/ProtectedRoute.jsx';
import { RoleRoute } from './components/guards/RoleRoute.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';

import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { ForbiddenPage } from './pages/errors/ForbiddenPage.jsx';
import { NotFoundPage } from './pages/errors/NotFoundPage.jsx';
import { PlaceholderPage } from './pages/PlaceholderPage.jsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />

            {/* Authenticated App Shell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <PlaceholderPage
                    title="Dashboard"
                    description="Role-specific KPIs, stock alerts, and summary metrics."
                  />
                }
              />

              {/* Inventory */}
              <Route
                path="/items"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <PlaceholderPage
                      title="Inventory Catalog"
                      description="Master stock catalog, live balances, and item transactions."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/items/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <PlaceholderPage
                      title="Item Detail"
                      description="Item stock movement history, audit trail, and details."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/reorder"
                element={
                  <RoleRoute allowedRoles={['STORE_MANAGER', 'PROCUREMENT_OFFICER']}>
                    <PlaceholderPage
                      title="Reorder Suggestions"
                      description="Automated reorder triggers based on safety thresholds."
                    />
                  </RoleRoute>
                }
              />

              {/* Purchase Requests & Approvals */}
              <Route
                path="/requests"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <PlaceholderPage
                      title="Purchase Requests"
                      description="Requisitions list, line items, and approval states."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/requests/new"
                element={
                  <RoleRoute allowedRoles={['HOD', 'REQUESTER']}>
                    <PlaceholderPage
                      title="New Purchase Request"
                      description="Create and submit a multi-line requisition."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <PlaceholderPage
                      title="Purchase Request Detail"
                      description="Requisition details, approval audit log, and PO links."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/approvals"
                element={
                  <RoleRoute allowedRoles={['HOD', 'PRINCIPAL']}>
                    <PlaceholderPage
                      title="Approvals Queue"
                      description="Review, approve, or reject pending requisitions."
                    />
                  </RoleRoute>
                }
              />

              {/* Procurement & Orders */}
              <Route
                path="/procurement"
                element={
                  <RoleRoute allowedRoles={['PROCUREMENT_OFFICER']}>
                    <PlaceholderPage
                      title="Procurement Processing"
                      description="Assign suppliers, unit prices, and generate purchase orders."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']}>
                    <PlaceholderPage
                      title="Purchase Orders"
                      description="Supplier PO tracking, delivery pipelines, and goods receipt."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']}>
                    <PlaceholderPage
                      title="Purchase Order Detail"
                      description="PO lines, supplier fulfillment actions, and receipt processing."
                    />
                  </RoleRoute>
                }
              />

              {/* Masters */}
              <Route
                path="/suppliers"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <PlaceholderPage
                      title="Suppliers"
                      description="Approved supplier directory and performance metrics."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/suppliers/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <PlaceholderPage
                      title="Supplier Profile"
                      description="Supplier contacts, fulfilled orders, and delivery metrics."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <PlaceholderPage
                      title="Users"
                      description="User administration, account approval queue, and role assignments."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/departments"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <PlaceholderPage
                      title="Departments"
                      description="Academic and administrative department directory."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/categories"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <PlaceholderPage
                      title="Categories"
                      description="Item category taxonomy management."
                    />
                  </RoleRoute>
                }
              />

              {/* Reports & Notifications */}
              <Route
                path="/reports"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'HOD']}>
                    <PlaceholderPage
                      title="Reports & Analytics"
                      description="Inventory valuation, procurement turnaround, and export tools."
                    />
                  </RoleRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']}>
                    <PlaceholderPage
                      title="Notifications"
                      description="In-app alerts and notifications."
                    />
                  </RoleRoute>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
