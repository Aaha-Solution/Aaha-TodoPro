import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

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
import ProcessAuditNotifications from '../features/processAudit/Notifications';
import EditUser from '../features/processAudit/users/EditUser';
import UserDetails from '../features/processAudit/users/UserDetails';

// IHLR (In-House Line Rejection) Feature
import IhlrDashboard from '../features/ihlr/Dashboard';
import IhlrCreateRequest from '../features/ihlr/CreateRequest';
import IhlrMyRequests from '../features/ihlr/MyRequests';
import IhlrNotifications from '../features/ihlr/Notifications';
import IhlrProfile from '../features/ihlr/Profile';

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

        {/* Common Project-Wide User Management & Admin Add User Redirect */}
        <Route path="/users" element={<Navigate to="/process-audit/users" replace />} />
        <Route path="/admin/users" element={<Navigate to="/process-audit/users" replace />} />

        {/* Process Audit Observation Module Workspace */}
        <Route path="/process-audit" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ProcessAuditDashboard />} />
          <Route path="create-request" element={<CreateRequest />} />
          <Route path="my-requests" element={<MyRequests />} />
          <Route path="notifications" element={<ProcessAuditNotifications />} />
          <Route path="profile" element={<UserDetails />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="users/create" element={<Navigate to="/process-audit/users?action=new" replace />} />
          <Route path="users/edit/:id" element={<EditUser />} />
          <Route path="users/:id" element={<UserDetails />} />
        </Route>

        {/* IHLR (In-House Line Rejection) Module Workspace */}
        <Route path="/ihlr" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<IhlrDashboard />} />
          <Route path="create-request" element={<IhlrCreateRequest />} />
          <Route path="my-requests" element={<IhlrMyRequests />} />
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
