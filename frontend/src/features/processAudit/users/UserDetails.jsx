import React, { useState } from 'react';
import { Plus, X, Check, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const UserDetails = () => {
  const { user, login } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [activeUser, setActiveUser] = useState({
    name: 'iyyu',
    role: 'Request Creator',
    employeeId: 'USR-001',
    department: 'Production Planning',
    email: 'iyyu@inel.co.in',
  });

  const [directory, setDirectory] = useState([
    {
      id: 'USR-001',
      avatar: 'I',
      name: 'iyyu',
      isCurrent: true,
      title: 'Request Creator',
      role: 'Request Creator',
      department: 'Production Planning',
      email: 'iyyu@inel.co.in',
      status: 'Active',
      canDelete: false,
    },
    {
      id: 'USR-002',
      avatar: 'KV',
      name: 'Kumar Vel',
      isCurrent: false,
      title: 'Line Execution Lead',
      role: 'Line Execution Lead',
      department: 'Assembly',
      email: 'kumar.vel@inel.co.in',
      status: 'Active',
      canDelete: false,
    },
    {
      id: 'USR-003',
      avatar: 'RC',
      name: 'Ravi Chandran',
      isCurrent: false,
      title: 'Quality & Inspection Lead',
      role: 'Quality & Inspection Lead',
      department: 'Quality Control',
      email: 'ravi.chandran@inel.co.in',
      status: 'Active',
      canDelete: true,
    },
    {
      id: 'USR-005',
      avatar: 'SM',
      name: 'Suresh Menon',
      isCurrent: false,
      title: 'Machining Specialist',
      role: 'Machining Specialist',
      department: 'Machining & Tooling',
      email: 'suresh.menon@inel.co.in',
      status: 'Active',
      canDelete: true,
    },
    {
      id: 'USR-006',
      avatar: 'RS',
      name: 'Raj Sekhar',
      isCurrent: false,
      title: 'Approver 1 (Production Manager)',
      role: 'Approver 1 (Production Manager)',
      department: 'Plant',
      email: 'raj.sekhar@inel.co.in',
      status: 'Active',
      canDelete: false,
    },
    {
      id: 'USR-007',
      avatar: 'AM',
      name: 'Anand Mohan',
      isCurrent: false,
      title: 'Approver 2 (Plant Head / Director)',
      role: 'Approver 2 (Plant Head / Director)',
      department: 'Executive',
      email: 'anand.mohan@inel.co.in',
      status: 'Active',
      canDelete: false,
    },
  ]);

  const [newUserData, setNewUserData] = useState({
    name: '',
    role: 'Line Execution Lead',
    department: 'Assembly',
    email: '',
  });

  const handleSwitchUser = (targetUser) => {
    setActiveUser({
      name: targetUser.name,
      role: targetUser.role,
      employeeId: targetUser.id,
      department: targetUser.department,
      email: targetUser.email,
    });

    setDirectory(
      directory.map((u) => ({
        ...u,
        isCurrent: u.id === targetUser.id,
      }))
    );

    // Update global auth
    login(
      {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role.toUpperCase().replace(/\s+/g, '_'),
        department: targetUser.department,
      },
      'switched-token'
    );
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('Remove this user from the directory?')) {
      setDirectory(directory.filter((u) => u.id !== userId));
    }
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email) return;

    const initials = newUserData.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const newUser = {
      id: `USR-00${directory.length + 2}`,
      avatar: initials || 'U',
      name: newUserData.name,
      isCurrent: false,
      title: newUserData.role,
      role: newUserData.role,
      department: newUserData.department,
      email: newUserData.email,
      status: 'Active',
      canDelete: true,
    };

    setDirectory([...directory, newUser]);
    setShowCreateModal(false);
    setNewUserData({ name: '', role: 'Line Execution Lead', department: 'Assembly', email: '' });
  };

  return (
    <div className="space-y-7 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            User Profile & Team Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage personal credentials and create new users.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create New User</span>
        </button>
      </div>

      {/* Active Profile Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Active Profile Details
          </h3>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Logged In</span>
          </span>
        </div>

        <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center gap-8 justify-between">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-extrabold text-2xl shadow-md shadow-blue-600/20 shrink-0">
              {activeUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{activeUser.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">
                  {activeUser.role}
                </span>
              </div>
            </div>
          </div>

          {/* User Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-12 flex-1 lg:max-w-2xl">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                EMPLOYEE ID
              </span>
              <span className="block text-xs font-bold text-slate-800 mt-1 font-mono">
                {activeUser.employeeId}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                DEPARTMENT
              </span>
              <span className="block text-xs font-bold text-slate-800 mt-1">
                {activeUser.department}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                EMAIL ADDRESS
              </span>
              <span className="block text-xs font-bold text-slate-800 mt-1 truncate">
                {activeUser.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Production & System Users Directory */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Production & System Users Directory
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
              {directory.length} Registered Users
            </span>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create New User</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">USER</th>
                <th className="py-3.5 px-4">USER ID</th>
                <th className="py-3.5 px-4">ROLE</th>
                <th className="py-3.5 px-4">DEPARTMENT</th>
                <th className="py-3.5 px-4">EMAIL</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-6 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {directory.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition">
                  {/* User Column */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                        {u.avatar}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">
                          {u.name} {u.isCurrent && <span className="text-blue-600 font-medium">(Current)</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">{u.title}</p>
                      </div>
                    </div>
                  </td>

                  {/* User ID */}
                  <td className="py-4 px-4 font-mono font-semibold text-slate-600">{u.id}</td>

                  {/* Role */}
                  <td className="py-4 px-4">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                      {u.role}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="py-4 px-4 text-slate-700 font-medium">{u.department}</td>

                  {/* Email */}
                  <td className="py-4 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{u.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleSwitchUser(u)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition shadow-2xs cursor-pointer ${
                          u.isCurrent
                            ? 'bg-blue-50 text-blue-700 border-blue-200 cursor-default'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        Switch
                      </button>

                      {u.canDelete && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="px-2 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition shadow-2xs cursor-pointer"
                          title="Remove User"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create New Team User</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Enterprise Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="ramesh@inel.co.in"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Operational Role *
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option>Request Creator</option>
                  <option>Line Execution Lead</option>
                  <option>Quality & Inspection Lead</option>
                  <option>Machining Specialist</option>
                  <option>Approver 1 (Production Manager)</option>
                  <option>Approver 2 (Plant Head / Director)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Department *
                </label>
                <select
                  value={newUserData.department}
                  onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option>Production Planning</option>
                  <option>Assembly</option>
                  <option>Quality Control</option>
                  <option>Machining & Tooling</option>
                  <option>Plant</option>
                  <option>Executive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetails;
