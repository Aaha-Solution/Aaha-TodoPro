import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  Check,
  Building2,
  Mail,
  Lock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  setUsers,
  addUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} from '../../redux/slices/userSlice';
import { userService } from '../../services/userService';
import { DEPARTMENTS } from '../../utils/constants';

const ROLES = [
  'ADMIN',
  'USER'
];

const UserManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const isIhlr = location.pathname.startsWith('/ihlr');
  const { user: currentAuthUser, login: updateAuthUser } = useAuth();
  const { users } = useSelector((state) => state.user);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Form State for Add User
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    role: 'USER',
    department: 'PRODUCTION',
    status: 'Active',
    systems: ['processAudit', 'ihlr', 'tryOutStatus'],
    password: ''
  });

  // Load users from backend / local storage on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await userService.getUsers();
        dispatch(setUsers(data));
      } catch (err) {
        console.error('Failed to load users from DB:', err);
      }
    };
    fetchUsers();

    // If query string has ?action=new, open add modal directly
    if (searchParams.get('action') === 'new') {
      handleOpenAddModal();
    }
  }, [dispatch, searchParams]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAddModal = () => {
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      role: 'USER',
      department: 'PRODUCTION',
      status: 'ACTIVE',
      systems: ['processAudit', 'ihlr', 'tryOutStatus'],
      password: ''
    });
    setShowAddModal(true);
  };

  const handleDepartmentChange = (newDept) => {
    const isIncomingQuality = (newDept || '').trim().toUpperCase() === 'INCOMING QUALITY';
    setFormData((prev) => ({
      ...prev,
      department: newDept,
      role: isIncomingQuality ? 'ADMIN' : 'USER',
    }));
  };

  const handleEditDepartmentChange = (newDept) => {
    const isIncomingQuality = (newDept || '').trim().toUpperCase() === 'INCOMING QUALITY';
    setEditingUser((prev) => ({
      ...prev,
      department: newDept,
      role: isIncomingQuality ? 'ADMIN' : 'USER',
    }));
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Please provide full name and email address.');
      return;
    }

    try {
      const created = await userService.createUser(formData);
      const freshData = await userService.getUsers();
      dispatch(setUsers(freshData));
      setShowAddModal(false);
      showToast(`User "${created?.name || formData.name}" created successfully in Database!`);
    } catch (err) {
      alert('Failed to save user in DB: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenEditModal = (userToEdit) => {
    setEditingUser({
      ...userToEdit,
      status: userToEdit.status || 'ACTIVE'
    });
    setShowEditModal(true);
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser.name.trim()) return;

    try {
      // Email is fixed/disabled and not modified on update
      await userService.updateUser(editingUser.id, {
        name: editingUser.name,
        role: editingUser.role,
        department: editingUser.department,
        status: editingUser.status
      });
      const freshData = await userService.getUsers();
      dispatch(setUsers(freshData));
      setShowEditModal(false);
      showToast(`User "${editingUser.name}" updated successfully in Database!`);
    } catch (err) {
      alert('Failed to update user in DB: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (userId, userName) => {
    if (window.confirm(`Are you sure you want to delete user "${userName}" from the database?`)) {
      try {
        await userService.deleteUser(userId);
        const freshData = await userService.getUsers();
        dispatch(setUsers(freshData));
        showToast(`User "${userName}" was deleted from Database.`);
      } catch (err) {
        alert('Failed to delete user from DB: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleToggleStatus = async (userItem) => {
    const newStatus = (userItem.status === 'Active' || userItem.status === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
    try {
      await userService.updateUser(userItem.id, { ...userItem, status: newStatus });
      const freshData = await userService.getUsers();
      dispatch(setUsers(freshData));
      showToast(`Status updated to ${newStatus} for ${userItem.name}`);
    } catch (err) {
      alert('Failed to toggle status: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSwitchActiveUser = (targetUser) => {
    updateAuthUser(
      {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role.toUpperCase().replace(/\s+/g, '_'),
        department: targetUser.department
      },
      'switched-token'
    );
    showToast(`Switched active session to: ${targetUser.name} (${targetUser.role})`);
  };

  // Filter logic - users are common for all tabs
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      String(u.id)?.toLowerCase().includes(search.toLowerCase());

    const matchesDept = selectedDept === 'ALL' || u.department === selectedDept;
    const matchesRole = selectedRole === 'ALL' || (u.role && u.role.toLowerCase() === selectedRole.toLowerCase());
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'Active' && (u.status === 'Active' || u.status === 'ACTIVE')) ||
      (selectedStatus === 'Inactive' && (u.status === 'Inactive' || u.status === 'INACTIVE'));

    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  // KPI Metrics - Unified for all tabs
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.status === 'Active' || u.status === 'ACTIVE').length;
  const adminCount = users.filter((u) => (u.role || '').toLowerCase() === 'admin').length;
  const standardUserCount = users.filter((u) => (u.role || '').toLowerCase() === 'user').length;
  const isAdmin = currentAuthUser?.role?.toUpperCase() === 'ADMIN';

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          User Management is restricted to Administrators only. You do not have permissions to access enterprise user directory and access settings.
        </p>
        <button
          onClick={() => navigate(isIhlr ? '/ihlr/dashboard' : '/process-audit/dashboard')}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <span 
              className="hover:text-slate-800 cursor-pointer" 
              onClick={() => navigate(isIhlr ? '/ihlr/dashboard' : '/process-audit/dashboard')}
            >
              {isIhlr ? 'In-House Line Rejection' : 'Process Audit Observation'}
            </span>
            <span>/</span>
            <span className="text-blue-600 font-semibold">User &amp; Access Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Enterprise User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Common centralized administration across all manufacturing portals with unified access to all tabs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Privileges Active</span>
          </span>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

        {/* KPI Metrics Strip - Common across all tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{totalCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Common to all portals</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Status</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600">{activeCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{totalCount - activeCount} inactive</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Admin Users</span>
              <Shield className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-extrabold text-indigo-700">{adminCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Full administrative access</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Standard Users</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-blue-700">{standardUserCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Universal tabs access</p>
          </div>
        </div>

        {/* Filter and Search Bar Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user name, email, or employee ID..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition outline-none"
              />
            </div>

            {/* Department Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="ALL">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Status Filter & Reset */}
            <div className="md:col-span-2 flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              {(search || selectedDept !== 'ALL' || selectedRole !== 'ALL' || selectedStatus !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedDept('ALL');
                    setSelectedRole('ALL');
                    setSelectedStatus('ALL');
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Reset all filters"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Enterprise Users Directory
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                {filteredUsers.length} Users
              </span>
            </div>

            <div className="text-xs text-slate-400">
              Showing filtered results
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 text-center w-16">SL NO</th>
                  <th className="py-3.5 px-6">USER &amp; DETAILS</th>
                  <th className="py-3.5 px-4">EMPLOYEE ID</th>
                  <th className="py-3.5 px-4">ROLE</th>
                  <th className="py-3.5 px-4">DEPARTMENT</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No personnel found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Try refining your search terms or filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, index) => {
                    const isCurrent = currentAuthUser?.email?.toLowerCase() === u.email?.toLowerCase();

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* SL NO */}
                        <td className="py-4 px-4 text-center font-mono font-semibold text-slate-500">
                          {index + 1}
                        </td>

                        {/* User Column */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs shadow-2xs shrink-0">
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{u.name}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Current
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono block">{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Employee ID */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-700">
                          {u.id}
                        </td>

                        {/* Role */}
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
                            u.role?.toLowerCase() === 'admin'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {u.role}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-4 px-4 text-slate-700 font-medium">
                          {u.department}
                        </td>

                        {/* Status Toggle */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                              u.status === 'Active' || u.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' || u.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{u.status || 'Active'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit User */}
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
                              title="Edit user details and roles"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete User */}
                            <button
                              onClick={() => handleDelete(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition shadow-2xs cursor-pointer"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Enterprise User</h3>
                  <p className="text-[11px] text-slate-400">Assign role and system authorization</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Employee ID */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="e.g. USR-008"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Enterprise Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ramesh@inel.co.in"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department (First) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Role (Second) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Operational Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Initial Password & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  Save &amp; Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit User Details</h3>
                  <p className="text-[11px] text-slate-400">Employee ID: {editingUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                  <span>Enterprise Email</span>
                  <span className="text-[10px] text-slate-400 lowercase font-medium tracking-normal">(cannot be modified)</span>
                </label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed outline-none select-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department (First) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={editingUser.department}
                    onChange={(e) => handleEditDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Role (Second) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Operational Role *
                  </label>
                  <select
                    value={editingUser.role ? editingUser.role.toUpperCase() : 'USER'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Account Status
                </label>
                <select
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
