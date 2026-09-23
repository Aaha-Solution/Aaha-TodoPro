import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Layers,
  ClipboardCheck,
  Bell,
  User,
  LogOut,
  X,
  Users
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Sidebar = ({ isOpen, closeSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const userDept = (user?.department || (() => {
    try {
      const u = localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isIhlr = location.pathname.startsWith('/ihlr');
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'SUPER_ADMIN';
  const isIncomingQuality = userDept === 'INCOMING QUALITY';
  const canCreateProcessAudit = isIncomingQuality || isAdmin;
  const canTrackProcessAudit = isIncomingQuality || isAdmin;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isIhlr
    ? [
        { name: 'Dashboard', path: '/ihlr/dashboard', icon: LayoutDashboard },
        { name: 'Create Request', path: '/ihlr/create-request', icon: Plus, isAction: true },
        { name: 'My Requests', path: '/ihlr/my-requests', icon: Layers },
        { name: 'Approvals', path: '/ihlr/approvals', icon: ClipboardCheck },
        ...(isAdmin ? [{ name: 'User Management', path: '/ihlr/users', icon: Users }] : []),
        { name: 'Notifications', path: '/ihlr/notifications', icon: Bell },
        { name: 'Profile', path: '/ihlr/profile', icon: User },
      ]
    : [
        { name: 'Dashboard', path: '/process-audit/dashboard', icon: LayoutDashboard },
        ...(canCreateProcessAudit ? [{ name: 'Create Request', path: '/process-audit/create-request', icon: Plus, isAction: true }] : []),
        ...(canTrackProcessAudit ? [{ name: 'My Requests', path: '/process-audit/my-requests', icon: Layers }] : []),
        { name: 'Approvals', path: '/process-audit/approvals', icon: ClipboardCheck },
        ...(isAdmin ? [{ name: 'User Management', path: '/process-audit/users', icon: Users }] : []),
        { name: 'Notifications', path: '/process-audit/notifications', icon: Bell },
        { name: 'Profile', path: '/process-audit/profile', icon: User },
      ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Dark Sidebar matching the reference screenshot (#0b1120 / #0a0f1d) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-[#0a0f1d] text-white z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out border-r border-slate-800/60 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 flex flex-col flex-1 overflow-y-auto">
          {/* Top Logo and Title */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate('/system-selection')}
            >
              <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md">
                <img src="/images/logo.png" alt="INEL Logo" className="w-7 h-7 object-contain" />
              </div>
              <div className="leading-tight">
                <span className="block text-xs font-bold tracking-tight text-white">
                  India Nippon
                </span>
                <span className="block text-[10px] font-semibold text-slate-300">
                  Electricals Ltd
                </span>
                <span className="block text-[9px] text-slate-400 font-medium mt-0.5">
                  {isIhlr ? 'In-House Line Rejection' : 'Process Audit Observation'}
                </span>
              </div>
            </div>

            <button onClick={closeSidebar} className="p-1 text-slate-400 hover:text-white lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="my-5 p-3 rounded-2xl bg-[#131b2e] border border-slate-800 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${isIhlr ? 'bg-amber-600' : 'bg-blue-600'} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'I'}
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'iyyu'}</p>
              <p className="text-[10px] text-slate-400">{isIhlr ? 'IHLR Quality Team' : (userDept || 'Request Creator')}</p>
            </div>
          </div>

          {/* Active System Static Label */}
          <div className="mb-6 p-3 rounded-2xl bg-[#101728] border border-slate-800/90 select-none">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block font-mono">
              ACTIVE SYSTEM
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isIhlr ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`}></span>
              <span className="text-xs font-bold text-white">
                {isIhlr ? 'In-House Line Rejection' : 'Process Audit Observation'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) closeSidebar();
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? isIhlr
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                          : 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-400 hover:bg-[#131b2e] hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.isAction ? `+ ${item.name}` : item.name}</span>
                </NavLink>
              );
            })}
          </nav>

         
        </div>

        {/* Bottom Actions: Notifications & Logout */}
        <div className="p-5 border-t border-slate-800/80 space-y-1">
          <NavLink
            to={isIhlr ? "/ihlr/notifications" : "/process-audit/notifications"}
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-[#131b2e] hover:text-white transition"
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/30 hover:text-red-300 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
