import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  FileCheck2,
  AlertCircle,
  Wrench,
  ChevronDown,
  Check,
  Building2,
  Mail,
  Lock,
  ArrowRightLeft,
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

const DEPARTMENTS = [
  'Production Planning',
  'Assembly',
  'Quality Control',
  'Machining & Tooling',
  'Plant',
  'Maintenance',
  'Executive'
];

const ROLES = [
  'SUPER_ADMIN',
  'Request Creator',
  'Line Execution Lead',
  'Quality & Inspection Lead',
  'Machining Specialist',
  'Approver 1 (Production Manager)',
  'Approver 2 (Plant Head / Director)'
];

const SYSTEMS_CONFIG = [
  { id: 'processAudit', name: 'Process Audit Observation', short: 'Audit', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'ihlr', name: 'IHLR (Line Rejection)', short: 'IHLR', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'tryOutStatus', name: 'Try Out Status', short: 'Try Out', color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

const UserManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { user: currentAuthUser, login: updateAuthUser } = useAuth();
  const { users } = useSelector((state) => state.user);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedSystemFilter, setSelectedSystemFilter] = useState('ALL');
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
    role: 'Request Creator',
    department: 'Production Planning',
    status: 'Active',
    systems: ['processAudit', 'ihlr', 'tryOutStatus'],
    tempPassword: ''
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
      name: '',
      email: '',
      role: 'CREATOR',
      department: 'Production Planning',
      status: 'ACTIVE',
      systems: ['processAudit', 'ihlr', 'tryOutStatus'],
      tempPassword: 'PlantUser@123'
    });
    setShowAddModal(true);
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
    if (!editingUser.name.trim() || !editingUser.email.trim()) return;

    try {
      await userService.updateUser(editingUser.id, editingUser);
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

  const toggleSystemSelection = (systemId, isEditing = false) => {
    if (isEditing) {
      const current = editingUser.systems || [];
      const updated = current.includes(systemId)
        ? current.filter((s) => s !== systemId)
        : [...current, systemId];
      setEditingUser({ ...editingUser, systems: updated });
    } else {
      const current = formData.systems || [];
      const updated = current.includes(systemId)
        ? current.filter((s) => s !== systemId)
        : [...current, systemId];
      setFormData({ ...formData, systems: updated });
    }
  };

  // Filter logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      String(u.id)?.toLowerCase().includes(search.toLowerCase());

    const matchesDept = selectedDept === 'ALL' || u.department === selectedDept;
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    const matchesStatus = selectedStatus === 'ALL' || u.status === selectedStatus;

    const userSystems = u.systems || ['processAudit'];
    const matchesSystem =
      selectedSystemFilter === 'ALL' || userSystems.includes(selectedSystemFilter);

    return matchesSearch && matchesDept && matchesRole && matchesStatus && matchesSystem;
  });

  // KPI Metrics
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.status === 'Active').length;
  const processAuditAccessCount = users.filter((u) => (u.systems || ['processAudit']).includes('processAudit')).length;
  const ihlrAccessCount = users.filter((u) => (u.systems || []).includes('ihlr')).length;
  const tryOutAccessCount = users.filter((u) => (u.systems || []).includes('tryOutStatus')).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased flex flex-col justify-between font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Global Header */}
      <header className="w-full bg-white border-b border-slate-200/90 px-4 sm:px-8 py-3 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Brand & Return Navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/system-selection')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Back to Systems</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/system-selection')}>
              <img src="/images/logo.png" alt="INEL Logo" className="w-7 h-7 object-contain" />
              <div className="leading-tight">
                <span className="block text-xs font-bold text-slate-900 tracking-tight">India Nippon Electricals Ltd</span>
                <span className="block text-[10px] font-semibold text-slate-500">Enterprise User Directory &amp; RBAC</span>
              </div>
            </div>
          </div>

          {/* Right: Add User Primary Action & Profile */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition transform active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New User</span>
            </button>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            {/* Current Logged In Admin Profile */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentAuthUser?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="text-left hidden md:block leading-tight">
                <span className="block text-xs font-bold text-slate-900">{currentAuthUser?.name || 'iyyu'}</span>
                <span className="block text-[10px] text-blue-600 font-semibold">Super Admin • Full Control</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Title & Breadcrumbs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
              <span className="hover:text-slate-800 cursor-pointer" onClick={() => navigate('/system-selection')}>
                Portal Selection
              </span>
              <span>/</span>
              <span className="text-blue-600 font-semibold">User &amp; Access Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise User Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Common centralized administration for all manufacturing systems: Process Audit Observation, IHLR, and Try Out Status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Privileges Active</span>
            </span>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{totalCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Across all plants</p>
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
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Process Audit</span>
              <FileCheck2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-blue-700">{processAuditAccessCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Authorized users</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">IHLR Line</span>
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-extrabold text-red-700">{ihlrAccessCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Authorized users</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Try Out Status</span>
              <Wrench className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-extrabold text-purple-700">{tryOutAccessCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Authorized users</p>
          </div>
        </div>

        {/* Filter and Search Bar Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search */}
            <div className="md:col-span-4 relative">
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
            <div className="md:col-span-2">
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

            {/* System Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedSystemFilter}
                onChange={(e) => setSelectedSystemFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="ALL">All Systems</option>
                <option value="processAudit">Process Audit</option>
                <option value="ihlr">IHLR</option>
                <option value="tryOutStatus">Try Out Status</option>
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

              {(search || selectedDept !== 'ALL' || selectedRole !== 'ALL' || selectedSystemFilter !== 'ALL' || selectedStatus !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedDept('ALL');
                    setSelectedRole('ALL');
                    setSelectedSystemFilter('ALL');
                    setSelectedStatus('ALL');
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
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
                  <th className="py-3.5 px-6">USER &amp; DETAILS</th>
                  <th className="py-3.5 px-4">EMPLOYEE ID</th>
                  <th className="py-3.5 px-4">ROLE</th>
                  <th className="py-3.5 px-4">DEPARTMENT</th>
                  <th className="py-3.5 px-4">SYSTEM ACCESS</th>
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
                  filteredUsers.map((u) => {
                    const isCurrent = currentAuthUser?.email?.toLowerCase() === u.email?.toLowerCase();
                    const userSystems = u.systems || ['processAudit'];

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
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
                            u.role?.includes('ADMIN')
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : u.role?.includes('Approver')
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : u.role?.includes('Quality')
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {u.role}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-4 px-4 text-slate-700 font-medium">
                          {u.department}
                        </td>

                        {/* System Access Pills */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {SYSTEMS_CONFIG.map((sys) => {
                              const hasAccess = userSystems.includes(sys.id);
                              if (!hasAccess) return null;
                              return (
                                <span
                                  key={sys.id}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${sys.color}`}
                                  title={sys.name}
                                >
                                  {sys.short}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                              u.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{u.status || 'Active'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Switch active login for role simulation */}
                            <button
                              onClick={() => handleSwitchActiveUser(u)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
                              title="Simulate session as this user"
                            >
                              <span className="hidden sm:inline">Switch</span>
                              <ArrowRightLeft className="w-3 h-3 sm:hidden" />
                            </button>

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
      </main>

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
                {/* Role */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Operational Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Module Access Checkboxes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Assigned Operational Systems Access
                </label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {SYSTEMS_CONFIG.map((sys) => {
                    const isChecked = formData.systems?.includes(sys.id);
                    return (
                      <label
                        key={sys.id}
                        className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSystemSelection(sys.id, false)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{sys.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Initial Password & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={formData.tempPassword}
                      onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                      placeholder="PlantUser@123"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Enterprise Email *
                </label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Operational Role *
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={editingUser.department}
                    onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Module Access Checkboxes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Assigned Operational Systems Access
                </label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {SYSTEMS_CONFIG.map((sys) => {
                    const isChecked = editingUser.systems?.includes(sys.id);
                    return (
                      <label
                        key={sys.id}
                        className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSystemSelection(sys.id, true)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{sys.name}</span>
                      </label>
                    );
                  })}
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
