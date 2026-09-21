import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notifications: [
    { id: 1, title: 'New Audit Scheduled', message: 'Process audit for Assembly Line 2 scheduled tomorrow at 10 AM', time: '10m ago', read: false },
    { id: 2, title: 'Line Rejection Alert', message: 'SMT Line 1 reported 12 defects (Part INEL-CDI-902)', time: '1h ago', read: false },
    { id: 3, title: 'Sample Approved', message: 'EV Inverter Housing sample approval signed off by QC Lead', time: '3h ago', read: true },
  ],
  unreadCount: 2,
};

export const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.read).length;
    },
    markAsRead: (state, action) => {
      const n = state.notifications.find(item => item.id === action.payload);
      if (n && !n.read) {
        n.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(n => { n.read = true; });
      state.unreadCount = 0;
    },
  },
});

export const { setNotifications, markAsRead, markAllAsRead } = notificationSlice.actions;
export default notificationSlice.reducer;
