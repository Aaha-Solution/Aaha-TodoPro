import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AlertOctagon, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { closeStopperModal, triggerStopper } from '../redux/slices/stopperSlice';
import { useAuth } from '../hooks/useAuth';

const LineStopperModal = () => {
  const isModalOpen = useSelector((state) => state.stopper.isModalOpen);
  const dispatch = useDispatch();
  const { user } = useAuth();

  const [line, setLine] = useState('SMT Line 1 - Solder Paste Inspection');
  const [partNumber, setPartNumber] = useState('INEL-CDI-902');
  const [category, setCategory] = useState('Machine');
  const [severity, setSeverity] = useState('CRITICAL');
  const [reason, setReason] = useState('');
  const [containment, setContainment] = useState('');

  if (!isModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(
      triggerStopper({
        line,
        partNumber,
        category,
        severity,
        reason,
        containment,
        triggeredBy: user?.name || 'iyyu (QC Lead)',
        capaRequired: true,
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Trigger Emergency Line Stopper</h3>
              <p className="text-[11px] text-red-600 font-semibold uppercase tracking-wider">
                Andon Quality Interruption
              </p>
            </div>
          </div>
          <button
            onClick={() => dispatch(closeStopperModal())}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Manufacturing Line *
              </label>
              <select
                value={line}
                onChange={(e) => setLine(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-red-500"
              >
                <option value="SMT Line 1 - Solder Paste Inspection">SMT Line 1</option>
                <option value="Stator Winding Cell 3">Stator Winding Cell 3</option>
                <option value="Rotor Die-Casting HPDC">Rotor Die-Casting HPDC</option>
                <option value="Final Assembly Line 2">Final Assembly Line 2</option>
                <option value="Regulator Testing Rig">Regulator Testing Rig</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Part Number *
              </label>
              <input
                type="text"
                required
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="e.g. INEL-CDI-902"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-red-500"
              >
              </input>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                4M Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-red-500"
              >
                <option value="Machine">Machine (Equipment malfunction)</option>
                <option value="Material">Material (Raw stock defect)</option>
                <option value="Method">Method (SOP deviation)</option>
                <option value="Man">Man (Operator training / error)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Severity Level *
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-red-500 font-semibold text-red-600"
              >
                <option value="CRITICAL">CRITICAL (Immediate Line Stop)</option>
                <option value="MAJOR">MAJOR (Hold Batch)</option>
                <option value="MODERATE">MODERATE (Special Inspection)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Defect Details & Root Cause *
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe exact defect observed, defect quantity, visual findings..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Immediate Containment Actions *
            </label>
            <textarea
              required
              rows={2}
              value={containment}
              onChange={(e) => setContainment(e.target.value)}
              placeholder="Quarantined lot count, physical red-tagging, line halted, supervisor notified..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => dispatch(closeStopperModal())}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-600/20 flex items-center justify-center gap-1.5"
            >
              <AlertOctagon className="w-4 h-4" />
              Broadcast Line Stop
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LineStopperModal;
