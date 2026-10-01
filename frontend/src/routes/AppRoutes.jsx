import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { clearIhlrDraft } from '../utils/storage';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

// Auth & System Selection
import Login from '../features/auth/Login';
import ForgotPassword from '../features/auth/ForgotPassword';
import SystemSelection from '../features/systemSelection/SystemSelection';

// Common User & Access Management Feature
import UserManagement from '../features/users/UserManagement';

// Process Audit Observation Feature
import ProcessAuditDashboard from '../features/processAudit/Dashboard';
import CreateRequest from '../features/processAudit/CreateRequest';
import MyRequests from '../features/processAudit/MyRequests';
import ProcessAuditApprovals from '../features/processAudit/Approvals';
import ProcessAuditNotifications from '../features/processAudit/Notifications';
import ProcessAuditProfile from '../features/processAudit/Profile';

// IHLR (In-House Line Rejection) Feature
import IhlrDashboard from '../features/ihlr/Dashboard';
import IhlrCreateRequest from '../features/ihlr/CreateRequest';
import IhlrMyRequests from '../features/ihlr/MyRequests';
import IhlrApprovals from '../features/ihlr/Approvals';
import IhlrNotifications from '../features/ihlr/Notifications';
import IhlrProfile from '../features/ihlr/Profile';

// Route Guards
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  const location = useLocation();

  useEffect(() => {
    // When switching to other main tabs/modules (like process-audit, system-selection, login), clear IHLR draft
    if (!location.pathname.startsWith('/ihlr')) {
      clearIhlrDraft();
    }
  }, [location.pathname]);

  return (
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
          <Route path="my-requests" element={<MyRequests />} />
          <Route path="approvals" element={<ProcessAuditApprovals />} />
          <Route path="notifications" element={<ProcessAuditNotifications />} />
          <Route path="profile" element={<ProcessAuditProfile />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="users/*" element={<Navigate to="/process-audit/users" replace />} />
        </Route>

        {/* IHLR (In-House Line Rejection) Module Workspace */}
        <Route path="/ihlr" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<IhlrDashboard />} />
          <Route path="create-request" element={<IhlrCreateRequest />} />
          <Route path="my-requests" element={<IhlrMyRequests />} />
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
  );
};

export default AppRoutes;
