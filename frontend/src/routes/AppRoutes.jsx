import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

// Auth & System Selection
import Login from '../features/auth/Login';
import ForgotPassword from '../features/auth/ForgotPassword';
import SystemSelection from '../features/systemSelection/SystemSelection';

// Process Audit Observation Feature
import ProcessAuditDashboard from '../features/processAudit/Dashboard';
import CreateRequest from '../features/processAudit/CreateRequest';
import MyRequests from '../features/processAudit/MyRequests';
import ProcessAuditNotifications from '../features/processAudit/Notifications';
import ProcessAuditUsers from '../features/processAudit/users/Users';
import CreateUser from '../features/processAudit/users/CreateUser';
import EditUser from '../features/processAudit/users/EditUser';
import UserDetails from '../features/processAudit/users/UserDetails';

// Route Guards
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {/* System Selection Portal */}
        <Route path="/system-selection" element={<SystemSelection />} />
        <Route path="/dashboard" element={<Navigate to="/process-audit/dashboard" replace />} />

        {/* Process Audit Observation Module Workspace */}
        <Route path="/process-audit" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ProcessAuditDashboard />} />
          <Route path="create-request" element={<CreateRequest />} />
          <Route path="my-requests" element={<MyRequests />} />
          <Route path="notifications" element={<ProcessAuditNotifications />} />
          <Route path="profile" element={<UserDetails />} />
          <Route path="users" element={<ProcessAuditUsers />} />
          <Route path="users/create" element={<CreateUser />} />
          <Route path="users/edit/:id" element={<EditUser />} />
          <Route path="users/:id" element={<UserDetails />} />
        </Route>
      </Route>

      {/* Default Fallback */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/system-selection" replace />} />
    </Routes>
  );
};

export default AppRoutes;
