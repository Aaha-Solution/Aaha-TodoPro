import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  rejections: [],
  scrapRecords: [],
  dashboardStats: {
    totalRejections: 128,
    ppmRate: 420,
    pendingRCA: 4,
  },
  loading: false,
  error: null,
};

export const ihlrSlice = createSlice({
  name: 'ihlr',
  initialState,
  reducers: {
    setRejections: (state, action) => {
      state.rejections = action.payload;
    },
    setScrapRecords: (state, action) => {
      state.scrapRecords = action.payload;
    },
    setDashboardStats: (state, action) => {
      state.dashboardStats = action.payload;
    },
  },
});

export const { setRejections, setScrapRecords, setDashboardStats } = ihlrSlice.actions;
export default ihlrSlice.reducer;
