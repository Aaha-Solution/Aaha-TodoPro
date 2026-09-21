import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  trials: [],
  pilotBatches: [],
  dashboardStats: {
    activeTrials: 14,
    pendingApprovals: 6,
  },
  loading: false,
};

export const tryOutSlice = createSlice({
  name: 'tryOut',
  initialState,
  reducers: {
    setTrials: (state, action) => {
      state.trials = action.payload;
    },
    setDashboardStats: (state, action) => {
      state.dashboardStats = action.payload;
    },
  },
});

export const { setTrials, setDashboardStats } = tryOutSlice.actions;
export default tryOutSlice.reducer;
