import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileCheck2, 
  AlertCircle, 
  Wrench, 
  ArrowRight, 
  LogOut, 
  Info,
  Users
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const SystemSelection = () => {
  const navigate = useNavigate();
  const { user, logout, switchSystem } = useAuth();

  const handleSelectSystem = (systemId, path) => {
    switchSystem(systemId);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const modules = [
    {
      id: 'processAudit',
      number: '1',
      badge: 'Audit & Compliance',
      badgeColor: 'bg-blue-50 text-blue-600 border border-blue-100',
      numberColor: 'bg-blue-50 text-blue-600 border border-blue-100',
      cardBorder: 'border-2 border-blue-500 shadow-sm',
      iconBoxColor: 'bg-blue-50 text-blue-600',
      icon: FileCheck2,
      title: 'Process Audit Observation',
      description:
        'Line observation logging, 4M compliance checklists, non-conformance audits, floor corrective actions & verification reviews.',
      tags: ['4M Audit Checks', 'Line Observation', 'CAPA Tracker'],
      path: '/process-audit/dashboard',
    },
    {
      id: 'ihlr',
      number: '2',
      badge: 'Line Rejection',
      badgeColor: 'bg-red-50 text-red-600 border border-red-100',
      numberColor: 'bg-red-50 text-red-600 border border-red-100',
      cardBorder: 'border border-slate-200/90 border-t-[3px] border-t-red-500 shadow-sm',
      iconBoxColor: 'bg-red-50 text-red-600',
      icon: AlertCircle,
      title: 'IHLR',
      description:
        'In-House Line Rejection monitoring, scrap analysis, defect categorization, root cause containment & PPM performance tracking.',
      tags: ['Line Rejection', 'Scrap Monitoring', 'Root Cause 8D'],
      path: '/ihlr/dashboard',
    },
    {
      id: 'tryOutStatus',
      number: '3',
      badge: 'Tool & Die Trial',
      badgeColor: 'bg-purple-50 text-purple-600 border border-purple-100',
      numberColor: 'bg-purple-50 text-purple-600 border border-purple-100',
      cardBorder: 'border border-slate-200/90 border-t-[3px] border-t-purple-500 shadow-sm',
      iconBoxColor: 'bg-purple-50 text-purple-600',
      icon: Wrench,
      title: 'Try Out Status',
      description:
        'Tool & die trial run monitoring, pilot batch testing, engineering change validations & multi-tier sample sign-offs.',
      tags: ['Trial Run Status', 'Pilot Batch Run', 'Sample Approval'],
      path: '/tryout-status/dashboard',
    },
  ];

  const currentUserName = user?.name || 'Admin';

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-slate-800 antialiased">
      {/* Top Navigation Bar */}
      <header className="w-full bg-white border-b border-slate-200/80 px-6 sm:px-10 py-3 flex items-center justify-between shadow-xs">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/system-selection')}>
            <img 
              src="/images/logo.png" 
              alt="India Nippon Electricals Logo" 
              className="w-7 h-7 object-contain"
            />
            <div className="leading-tight">
              <span className="block text-xs font-bold text-slate-900 tracking-tight">
                India Nippon
              </span>
              <span className="block text-[11px] font-semibold text-slate-600 -mt-0.5">
                Electricals Ltd
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block mx-1" />

          <span className="text-xs font-bold tracking-wider text-slate-700 uppercase hidden sm:block">
            QUALITY &amp; PRODUCTION PORTAL
          </span>
        </div>

        {/* Right User Bar */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/users')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-all shadow-2xs cursor-pointer"
            title="Enterprise User Directory"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Users</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div 
            onClick={() => navigate('/users')}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition"
            title="Manage user directory"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUserName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs text-slate-600">
                Logged in as <span className="font-bold text-slate-900">{currentUserName}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Admin • Production Planning
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 bg-white hover:bg-red-50/50 border border-red-200 rounded-md transition-all cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Portal Selection Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col justify-center">
        {/* Title Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue-600 mb-2 font-mono">
            WORKSPACE PORTAL SELECTION
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Select Operational System
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2.5 font-normal leading-relaxed">
            Please select one of the core manufacturing modules below to access the main workflow workspace.
          </p>
        </div>

        {/* 3 Operational System Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={() => handleSelectSystem(mod.id, mod.path)}
                className={`group relative bg-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-md ${mod.cardBorder}`}
              >
                <div>
                  {/* Top Bar: Number & Category Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${mod.numberColor}`}>
                      {mod.number}
                    </div>
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${mod.badgeColor}`}>
                      {mod.badge}
                    </span>
                  </div>

                  {/* Icon Box */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${mod.iconBoxColor} transition-transform group-hover:scale-105`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal mb-6">
                    {mod.description}
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {mod.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Launch Module Action Row */}
                <div className="pt-2 flex items-center justify-between text-slate-900">
                  <span className="text-xs font-bold">
                    Launch Module
                  </span>
                  <div className="flex items-center justify-center text-slate-900 group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Informational Help Line */}
        <div className="mt-14 text-center flex items-center justify-center gap-2 text-xs text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Select any module to open the main workspace screen. You can switch between modules at any time from the top navigation bar.
          </span>
        </div>
      </main>
    </div>
  );
};

export default SystemSelection;
