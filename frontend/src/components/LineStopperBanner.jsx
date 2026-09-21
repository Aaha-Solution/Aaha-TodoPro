import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AlertOctagon, CheckCircle2, ChevronRight, ShieldAlert, X } from 'lucide-react';
import { clearStopper } from '../redux/slices/stopperSlice';
import { useAuth } from '../hooks/useAuth';

const LineStopperBanner = () => {
  const { stoppers, activeStopperCount } = useSelector((state) => state.stopper);
  const activeStoppers = stoppers.filter((s) => s.status === 'ACTIVE');
  const [selectedStopper, setSelectedStopper] = useState(null);
  const [clearanceRemarks, setClearanceRemarks] = useState('');
  const { user } = useAuth();
  const dispatch = useDispatch();

  if (activeStopperCount === 0) return null;

  const current = activeStoppers[0];

  const handleClearStopper = (e) => {
    e.preventDefault();
    if (!selectedStopper) return;
    dispatch(
      clearStopper({
        id: selectedStopper.id,
        clearedBy: user?.name || 'Siva Subramanian (QC Lead)',
        clearanceRemarks: clearanceRemarks || 'Containment confirmed, inspection verified. Line authorized to resume.',
      })
    );
    setSelectedStopper(null);
    setClearanceRemarks('');
  };

  return (
    <>
      <div className="mb-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-2xl p-4 text-white shadow-lg shadow-red-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse-slow">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-white animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest bg-white text-red-700 px-2 py-0.5 rounded-full font-mono">
                EMERGENCY LINE STOPPER ACTIVE
              </span>
              <span className="text-xs font-semibold text-white/90">
                ({activeStopperCount} active halt)
              </span>
            </div>
            <p className="text-sm font-bold mt-1 text-white">
              {current.line} — {current.partNumber}
            </p>
            <p className="text-xs text-white/80 mt-0.5 line-clamp-1">
              Reason: {current.reason} | Containment: {current.containment}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setSelectedStopper(current)}
            className="w-full md:w-auto px-4 py-2 bg-white hover:bg-white/90 text-red-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Review & Clear Stopper</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Clearance Sign-off Modal */}
      {selectedStopper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Line Stopper Sign-off & Clearance</h3>
                  <p className="text-[11px] text-slate-500">{selectedStopper.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStopper(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="font-semibold text-slate-500 block">Line & Station:</span>
                <span className="font-bold text-slate-800">{selectedStopper.line}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Part Number:</span>
                <span className="font-bold text-slate-800">{selectedStopper.partNumber}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Defect Root Cause / Reason:</span>
                <span className="text-slate-700">{selectedStopper.reason}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block">Active Containment:</span>
                <span className="text-slate-700">{selectedStopper.containment}</span>
              </div>
            </div>

            <form onSubmit={handleClearStopper} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Quality Clearance Sign-Off Remarks *
                </label>
                <textarea
                  required
                  rows={3}
                  value={clearanceRemarks}
                  onChange={(e) => setClearanceRemarks(e.target.value)}
                  placeholder="State containment verification, corrective action verified, and authorization to restart production..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStopper(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Authorize Line Restart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LineStopperBanner;
