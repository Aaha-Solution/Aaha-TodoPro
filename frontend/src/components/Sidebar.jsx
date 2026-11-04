import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Layers,
  ClipboardCheck,
  Bell,
  LogOut,
  X,
  Users
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useModal } from '../context/ModalContext';
import { useSelector } from 'react-redux';

const Sidebar = ({ isOpen, closeSidebar }) => {
  const { user, logout } = useAuth();
  const { confirm } = useModal();
  const { unreadCount } = useSelector((state) => state.notification);
  const navigate = useNavigate();
  const location = useLocation();

  const userDept = (user?.department || (() => {
    try {
      const u = sessionStorage.getItem('todo_user') || localStorage.getItem('todo_user');
      return u ? JSON.parse(u)?.department : '';
    } catch {
      return '';
    }
  })() || '').trim().toUpperCase();

  const isIhlr = location.pathname.startsWith('/ihlr');
  const isQad = userDept === 'QAD';
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || isQad;
  const isProduction = userDept === 'PRODUCTION';
  const canCreate = isQad || isAdmin || isProduction;

  const handleLogout = async () => {
    const isConfirmed = await confirm({
      title: 'Confirm Logout',
      message: 'Are you sure you want to log out of your session?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      isDestructive: true,
      type: 'warning',
    });

    if (isConfirmed) {
      logout();
      navigate('/login');
    }
  };

  const isUserRole = user?.role?.toUpperCase() === 'USER' || (!isAdmin);
  const prefix = isIhlr ? '/ihlr' : '/process-audit';

  const navItems = isUserRole
    ? [
        { name: 'Dashboard', path: `${prefix}/dashboard`, icon: LayoutDashboard },
        { name: 'My Action', path: `${prefix}/approvals`, icon: ClipboardCheck },
        { name: 'My Notifications', path: `${prefix}/notifications`, icon: Bell },
        { name: 'All Requests', path: `${prefix}/all-requests`, icon: Layers },
        ...(canCreate ? [{ name: 'Create Request', path: `${prefix}/create-request`, icon: Plus, isAction: true }] : []),
      ]
    : [
        { name: 'Dashboard', path: `${prefix}/dashboard`, icon: LayoutDashboard },
        ...(canCreate ? [{ name: 'Create Request', path: `${prefix}/create-request`, icon: Plus, isAction: true }] : []),
        { name: 'All Requests', path: `${prefix}/all-requests`, icon: Layers },
        { name: 'My Action', path: `${prefix}/approvals`, icon: ClipboardCheck },
        ...(isAdmin ? [{ name: 'User Management', path: `${prefix}/users`, icon: Users }] : []),
        { name: 'My Notifications', path: `${prefix}/notifications`, icon: Bell },
      ];

  const isItemActive = (item) => {
    const cur = location.pathname.toLowerCase().replace(/\/+$/, '');
    const target = item.path.toLowerCase().replace(/\/+$/, '');

    // Exact match
    if (cur === target) return true;

    // Both /all-requests and /my-requests map to "All Requests"
    const isTargetRequests = target.endsWith('/all-requests') || target.endsWith('/my-requests');
    const isCurRequests = cur.endsWith('/all-requests') || cur.endsWith('/my-requests');
    if (isTargetRequests && isCurRequests) {
      const isTargetIhlr = target.startsWith('/ihlr');
      const isCurIhlr = cur.startsWith('/ihlr');
      if (isTargetIhlr === isCurIhlr) return true;
    }

    // Approvals: handle subpaths or exact
    if (target.endsWith('/approvals') && (cur.endsWith('/approvals') || cur.includes('/approvals/'))) {
      const isTargetIhlr = target.startsWith('/ihlr');
      const isCurIhlr = cur.startsWith('/ihlr');
      if (isTargetIhlr === isCurIhlr) return true;
    }

    // Users: handle subpaths
    if (target.endsWith('/users') && (cur.endsWith('/users') || cur.includes('/users/'))) {
      const isTargetIhlr = target.startsWith('/ihlr');
      const isCurIhlr = cur.startsWith('/ihlr');
      if (isTargetIhlr === isCurIhlr) return true;
    }

    // Dashboard
    if (target.endsWith('/dashboard') && cur.endsWith('/dashboard')) {
      const isTargetIhlr = target.startsWith('/ihlr');
      const isCurIhlr = cur.startsWith('/ihlr');
      if (isTargetIhlr === isCurIhlr) return true;
    }

    // Create Request
    if (target.endsWith('/create-request') && cur.endsWith('/create-request')) {
      const isTargetIhlr = target.startsWith('/ihlr');
      const isCurIhlr = cur.startsWith('/ihlr');
      if (isTargetIhlr === isCurIhlr) return true;
    }

    // Notifications
    if (target.endsWith('/notifications') && cur.endsWith('/notifications')) {
      const isTargetIhlr = target.startsWith('/ihlr');
      const isCurIhlr = cur.startsWith('/ihlr');
      if (isTargetIhlr === isCurIhlr) return true;
    }

    return false;
  };

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
          <div className="flex items-center justify-between pb-5 border-b border-slate-800/80 mb-6">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => navigate('/system-selection')}
            >
              <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md">
                <img src="/images/logo.png" alt="INEL Logo" className="w-7 h-7 object-contain" />
              </div>
              <span className="text-base font-bold tracking-wider text-white">
                Q-TRACK
              </span>
            </div>

            <button onClick={closeSidebar} className="p-1 text-slate-400 hover:text-white lg:hidden">
              <X className="w-5 h-5" />
            </button>
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
                  className={({ isActive: navLinkIsActive }) => {
                    const active = navLinkIsActive || isItemActive(item);
                    return `flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? isIhlr
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                          : 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-400 hover:bg-[#131b2e] hover:text-white'
                    }`;
                  }}
                >
                  <Icon className="w-4 h-4 stroke-[2]" />
                  <span className="flex-1 text-left">{item.name}</span>
                  {(item.name === 'My Notifications' || item.name === 'Notifications') && unreadCount > 0 && (
                    <span className="relative flex items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative px-1.5 py-0.5 text-[10px] font-extrabold bg-red-600 text-white rounded-full leading-none shadow-xs">
                        {unreadCount}
                      </span>
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

         
        </div>

        {/* Bottom Actions: Logout */}
        <div className="p-5 border-t border-slate-800/80">
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
