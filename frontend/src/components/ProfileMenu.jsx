import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Shield, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const ProfileMenu = () => {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.name || 'iyyu';
  const displayEmail = user?.email || 'iyyu@inel.co.in';
  const displayRole = user?.role || 'ADMIN';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
          {displayName.charAt(0)}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-xs font-semibold text-slate-800 leading-tight">{displayName}</p>
          <p className="text-[10px] text-slate-500 capitalize">{displayRole.toLowerCase().replace('_', ' ')}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-800">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{displayEmail}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-100">
              <Shield className="w-3 h-3" />
              {displayRole}
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                navigate('/system-selection');
                setOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              Switch System Module
            </button>
          </div>

          <div className="pt-1 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
