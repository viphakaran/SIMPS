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

import { DashboardPage } from './pages/dashboard/DashboardPage.jsx';
import { UsersPage } from './pages/users/UsersPage.jsx';
import { DepartmentsPage } from './pages/masters/DepartmentsPage.jsx';
import { CategoriesPage } from './pages/masters/CategoriesPage.jsx';
import { SuppliersPage } from './pages/suppliers/SuppliersPage.jsx';
import { SupplierDetailPage } from './pages/suppliers/SupplierDetailPage.jsx';
import { ItemsPage } from './pages/inventory/ItemsPage.jsx';
import { ItemDetailPage } from './pages/inventory/ItemDetailPage.jsx';
import { ReorderPage } from './pages/inventory/ReorderPage.jsx';
import { RequestsPage } from './pages/requests/RequestsPage.jsx';
import { NewRequestPage } from './pages/requests/NewRequestPage.jsx';
import { RequestDetailPage } from './pages/requests/RequestDetailPage.jsx';
import { ApprovalsPage } from './pages/approvals/ApprovalsPage.jsx';
import { ProcurementPage } from './pages/procurement/ProcurementPage.jsx';
import { OrdersPage } from './pages/orders/OrdersPage.jsx';
import { OrderDetailPage } from './pages/orders/OrderDetailPage.jsx';
import { ReportsPage } from './pages/reports/ReportsPage.jsx';
import { NotificationsPage } from './pages/notifications/NotificationsPage.jsx';

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
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Inventory */}
              <Route
                path="/items"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <ItemsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/items/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <ItemDetailPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/reorder"
                element={
                  <RoleRoute allowedRoles={['STORE_MANAGER', 'PROCUREMENT_OFFICER']}>
                    <ReorderPage />
                  </RoleRoute>
                }
              />

              {/* Purchase Requests & Approvals */}
              <Route
                path="/requests"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <RequestsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/requests/new"
                element={
                  <RoleRoute allowedRoles={['HOD', 'REQUESTER']}>
                    <NewRequestPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <RequestDetailPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/approvals"
                element={
                  <RoleRoute allowedRoles={['HOD', 'PRINCIPAL']}>
                    <ApprovalsPage />
                  </RoleRoute>
                }
              />

              {/* Procurement & Orders */}
              <Route
                path="/procurement"
                element={
                  <RoleRoute allowedRoles={['PROCUREMENT_OFFICER']}>
                    <ProcurementPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']}>
                    <OrdersPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']}>
                    <OrderDetailPage />
                  </RoleRoute>
                }
              />

              {/* Masters */}
              <Route
                path="/suppliers"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <SuppliersPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/suppliers/:id"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER']}>
                    <SupplierDetailPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <UsersPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/departments"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <DepartmentsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/categories"
                element={
                  <RoleRoute allowedRoles={['ADMIN']}>
                    <CategoriesPage />
                  </RoleRoute>
                }
              />

              {/* Reports & Notifications */}
              <Route
                path="/reports"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'HOD']}>
                    <ReportsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'PRINCIPAL', 'HOD', 'REQUESTER', 'PROCUREMENT_OFFICER', 'STORE_MANAGER', 'SUPPLIER']}>
                    <NotificationsPage />
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
