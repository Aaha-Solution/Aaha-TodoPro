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
      const target = action.payload;
      let anyChanged = false;
      state.notifications.forEach(item => {
        const matches =
          item.id === target ||
          item.notifId === target ||
          item.rawId === target ||
          String(item.id) === String(target) ||
          String(item.id) === `notif-${target}` ||
          String(item.notifId) === String(target) ||
          (item.reqNo && target && (item.reqNo === target || item.reqNo === `#${target}` || `#${item.reqNo}` === target));
        if (matches && !item.read) {
          item.read = true;
          anyChanged = true;
        }
      });
      state.unreadCount = state.notifications.filter(item => !item.read).length;
    },
    decrementUnreadCount: (state, action) => {
      const dec = typeof action.payload === 'number' ? action.payload : 1;
      state.unreadCount = Math.max(0, state.unreadCount - dec);
    },
    markAsUnread: (state, action) => {
      const n = state.notifications.find(item => item.id === action.payload || item.notifId === action.payload);
      if (n && n.read) {
        n.read = false;
        state.unreadCount = state.notifications.filter(item => !item.read).length;
      }
    },
    toggleNotificationRead: (state, action) => {
      const n = state.notifications.find(item => item.id === action.payload || item.notifId === action.payload);
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
  decrementUnreadCount,
  markAsUnread,
  toggleNotificationRead,
  markAllAsRead
} = notificationSlice.actions;
export default notificationSlice.reducer;
