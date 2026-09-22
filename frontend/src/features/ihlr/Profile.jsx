import React from 'react';
import { User, Mail, Shield, Building2, CheckCircle2, Award, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const IhlrProfile = () => {
  const { user } = useAuth();

  const activeName = user?.name || 'iyyu';
  const activeEmail = user?.email || 'iyyu@inel.co.in';
  const activeRole = user?.role || 'Quality Assurance Lead';
  const activeDepartment = user?.department || 'INCOMING QUALITY';

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span className="text-blue-600 font-bold uppercase tracking-wider font-mono">IHLR REPOSITORY</span>
          <span>/</span>
          <span>User Profile</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Personnel Profile &amp; Role Authorization
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Authenticated credentials, role privileges, and IHLR approval capabilities.
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-slate-100">
          <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-3xl shadow-md shadow-blue-600/20">
            {activeName.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{activeName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-blue-600">{activeRole}</p>
            <p className="text-xs text-slate-400 font-mono">{activeEmail}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
              DEPARTMENT
            </span>
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>{activeDepartment}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
              AUTHORIZATION LEVEL
            </span>
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>IHLR Lead Approver</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
              SYSTEM PORTAL
            </span>
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Award className="w-4 h-4 text-amber-600" />
              <span>In-House Line Rejection (IHLR)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IhlrProfile;
