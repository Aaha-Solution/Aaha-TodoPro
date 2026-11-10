import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { clearIhlrDraft } from '../utils/storage';

// Immediate Auth Layout, Login & Guard (kept eager for fast initial paint)
import AuthLayout from '../layouts/AuthLayout';
import Login from '../features/auth/Login';
import ProtectedRoute from './ProtectedRoute';

// Lazy-loaded Auth & System Selection
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword'));
const SystemSelection = lazy(() => import('../features/systemSelection/SystemSelection'));
const DashboardLayout = lazy(() => import('../layouts/DashboardLayout'));

// Lazy-loaded Common User & Access Management Feature
const UserManagement = lazy(() => import('../features/users/UserManagement'));

// Lazy-loaded Process Audit Observation Feature
const ProcessAuditDashboard = lazy(() => import('../features/processAudit/Dashboard'));
const CreateRequest = lazy(() => import('../features/processAudit/CreateRequest'));
const AllRequests = lazy(() => import('../features/processAudit/AllRequests'));
const ProcessAuditApprovals = lazy(() => import('../features/processAudit/Approvals'));
const ProcessAuditNotifications = lazy(() => import('../features/processAudit/Notifications'));

// Lazy-loaded IHLR (In-House Line Rejection) Feature
const IhlrDashboard = lazy(() => import('../features/ihlr/Dashboard'));
const IhlrCreateRequest = lazy(() => import('../features/ihlr/CreateRequest'));
const IhlrAllRequests = lazy(() => import('../features/ihlr/AllRequests'));
const IhlrApprovals = lazy(() => import('../features/ihlr/Approvals'));
const IhlrNotifications = lazy(() => import('../features/ihlr/Notifications'));
const IhlrProfile = lazy(() => import('../features/ihlr/Profile'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-violet-600" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();

  useEffect(() => {
    // When switching to other main tabs/modules (like process-audit, system-selection, login), clear IHLR draft
    if (!location.pathname.startsWith('/ihlr')) {
      clearIhlrDraft();
    }
  }, [location.pathname]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/login" element={<Navigate to="/login" replace />} />
          <Route path="/auth/forgot-password" element={<Navigate to="/forgot-password" replace />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          {/* System Selection Portal */}
          <Route path="/system-selection" element={<SystemSelection />} />
          <Route path="/dashboard" element={<Navigate to="/process-audit/dashboard" replace />} />

          {/* Common Project-Wide User Management & Admin Add User Redirect */}
          <Route path="/users" element={<Navigate to="/process-audit/users" replace />} />
          <Route path="/admin/users" element={<Navigate to="/process-audit/users" replace />} />

          {/* Process Audit Observation Module Workspace */}
          <Route path="/process-audit" element={<DashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ProcessAuditDashboard />} />
            <Route path="create-request" element={<CreateRequest />} />
            <Route path="all-requests" element={<AllRequests />} />
            <Route path="my-requests" element={<AllRequests />} />
            <Route path="approvals" element={<ProcessAuditApprovals />} />
            <Route path="notifications" element={<ProcessAuditNotifications />} />
            <Route path="profile" element={<Navigate to="/process-audit/dashboard" replace />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="users/*" element={<Navigate to="/process-audit/users" replace />} />
          </Route>

          {/* IHLR (In-House Line Rejection) Module Workspace */}
          <Route path="/ihlr" element={<DashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<IhlrDashboard />} />
            <Route path="create-request" element={<IhlrCreateRequest />} />
            <Route path="all-requests" element={<IhlrAllRequests />} />
            <Route path="my-requests" element={<IhlrAllRequests />} />
            <Route path="approvals" element={<IhlrApprovals />} />
            <Route path="notifications" element={<IhlrNotifications />} />
            <Route path="profile" element={<IhlrProfile />} />
            <Route path="users" element={<UserManagement />} />
          </Route>
        </Route>

        {/* Default Fallback */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/system-selection" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
