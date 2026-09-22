import React from 'react';
import { Menu, ChevronDown, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Notification from './Notification';

const Header = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Match exact screenshot subtitles
  let pageTitle = 'Creator Dashboard';
  if (location.pathname.includes('/create-request')) {
    pageTitle = 'Create Production Request';
  } else if (location.pathname.includes('/my-requests')) {
    pageTitle = 'Request Tracking';
  } else if (location.pathname.includes('/notifications')) {
    pageTitle = 'Notification Center';
  } else if (location.pathname.includes('/profile') || location.pathname.includes('/users')) {
    pageTitle = 'User Profile & Team Management';
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Module Pill Dropdown */}
        <div 
          onClick={() => navigate('/system-selection')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold cursor-pointer transition"
        >
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>Module: <strong className="font-bold text-slate-900">Process Audit Observation</strong></span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
        </div>

       
      </div>

      {/* Right User & Stopper Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 rounded-xl transition shadow-2xs cursor-pointer"
          title="Enterprise User Directory"
        >
          <Users className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden md:inline">Users</span>
        </button>

        {/* Notification Bell */}
        <Notification />

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* User Info Avatar */}
        <div 
          onClick={() => navigate('/users')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
          title="Manage Users & Profile"
        >
          <div className="w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'I'}
          </div>
          <div className="text-left hidden sm:block leading-tight">
            <span className="block text-xs font-bold text-slate-900">{user?.name || 'iyyu'}</span>
            <span className="block text-[10px] text-slate-400 font-medium">Production Planning</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
