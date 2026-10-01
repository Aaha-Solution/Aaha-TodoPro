import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notifications: [],
  unreadCount: 0,
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
    markAsUnread: (state, action) => {
      const n = state.notifications.find(item => item.id === action.payload);
      if (n && n.read) {
        n.read = false;
        state.unreadCount = state.notifications.filter(item => !item.read).length;
      }
    },
    toggleNotificationRead: (state, action) => {
      const n = state.notifications.find(item => item.id === action.payload);
      if (n) {
        n.read = !n.read;
        state.unreadCount = state.notifications.filter(item => !item.read).length;
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(n => { n.read = true; });
      state.unreadCount = 0;
    },
  },
});

export const {
  setNotifications,
  markAsRead,
  markAsUnread,
  toggleNotificationRead,
  markAllAsRead
} = notificationSlice.actions;
export default notificationSlice.reducer;
