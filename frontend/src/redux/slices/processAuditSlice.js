import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  requests: [],
  selectedRequest: null,
  dashboardStats: {
    totalRequests: 42,
    pendingAudits: 8,
    completedAudits: 31,
    openCapa: 3,
  },
  loading: false,
  error: null,
};

export const processAuditSlice = createSlice({
  name: 'processAudit',
  initialState,
  reducers: {
    setRequests: (state, action) => {
      state.requests = action.payload;
    },
    setSelectedRequest: (state, action) => {
      state.selectedRequest = action.payload;
    },
    setDashboardStats: (state, action) => {
      state.dashboardStats = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const { setRequests, setSelectedRequest, setDashboardStats, setLoading } = processAuditSlice.actions;
export default processAuditSlice.reducer;
