import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  Layers,
  Bell,
  User,
  LogOut,
  ChevronRight,
  X,
  AlertOctagon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDispatch, useSelector } from 'react-redux';
import { openStopperModal } from '../redux/slices/stopperSlice';

const Sidebar = ({ isOpen, closeSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const activeStopperCount = useSelector((state) => state.stopper.activeStopperCount);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/process-audit/dashboard', icon: LayoutDashboard },
    { name: 'Create Request', path: '/process-audit/create-request', icon: Plus, isAction: true },
    { name: 'My Requests', path: '/process-audit/my-requests', icon: Layers },
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
                  Process Audit Observation
                </span>
              </div>
            </div>

            <button onClick={closeSidebar} className="p-1 text-slate-400 hover:text-white lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="my-5 p-3 rounded-2xl bg-[#131b2e] border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'I'}
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'iyyu'}</p>
              <p className="text-[10px] text-slate-400">Request Creator</p>
            </div>
          </div>

          {/* Active System Pill Card */}
          <div 
            onClick={() => navigate('/system-selection')}
            className="mb-6 p-3 rounded-2xl bg-[#101728] border border-slate-800/90 hover:border-slate-700 transition flex items-center justify-between cursor-pointer group"
          >
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block font-mono">
                ACTIVE SYSTEM
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                  Process Audit Observation
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition" />
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
                        ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30'
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

          {/* Emergency Line Stopper Quick Button */}
          <div className="my-4 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => dispatch(openStopperModal())}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeStopperCount > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{activeStopperCount > 0 ? `Stopper Active (${activeStopperCount})` : 'Line Stopper'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions: Notifications & Logout */}
        <div className="p-5 border-t border-slate-800/80 space-y-1">
          <NavLink
            to="/process-audit/notifications"
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
