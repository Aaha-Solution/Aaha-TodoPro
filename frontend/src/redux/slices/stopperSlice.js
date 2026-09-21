import { createSlice } from '@reduxjs/toolkit';

const initialStoppers = [
  {
    id: 'STOP-2026-004',
    line: 'SMT Line 1 - Solder Paste Inspection',
    partNumber: 'INEL-CDI-902',
    category: 'Material / Machine',
    reason: 'Excessive solder bridging observed on Microcontroller IC lead pitch (0.5mm)',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    triggeredBy: 'iyyu (QC Lead)',
    triggeredAt: '2026-09-17 14:15',
    containment: 'Line halted, 80 PCB units quarantined, stencil cleaning initiated',
    clearedBy: null,
    clearedAt: null,
    capaRequired: true,
  }
];

export const stopperSlice = createSlice({
  name: 'stopper',
  initialState: {
    stoppers: initialStoppers,
    activeStopperCount: 1,
    isModalOpen: false,
  },
  reducers: {
    openStopperModal: (state) => {
      state.isModalOpen = true;
    },
    closeStopperModal: (state) => {
      state.isModalOpen = false;
    },
    triggerStopper: (state, action) => {
      const newStopper = {
        id: `STOP-2026-00${state.stoppers.length + 1}`,
        status: 'ACTIVE',
        triggeredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        ...action.payload,
      };
      state.stoppers.unshift(newStopper);
      state.activeStopperCount = state.stoppers.filter(s => s.status === 'ACTIVE').length;
      state.isModalOpen = false;
    },
    clearStopper: (state, action) => {
      const { id, clearedBy, clearanceRemarks } = action.payload;
      const stopper = state.stoppers.find(s => s.id === id);
      if (stopper) {
        stopper.status = 'RESOLVED';
        stopper.clearedBy = clearedBy;
        stopper.clearanceRemarks = clearanceRemarks;
        stopper.clearedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      }
      state.activeStopperCount = state.stoppers.filter(s => s.status === 'ACTIVE').length;
    }
  }
});

export const { openStopperModal, closeStopperModal, triggerStopper, clearStopper } = stopperSlice.actions;
export default stopperSlice.reducer;
