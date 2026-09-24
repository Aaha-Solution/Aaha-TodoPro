import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import processAuditReducer from './slices/processAuditSlice';
import ihlrReducer from './slices/ihlrSlice';
import tryOutReducer from './slices/tryOutSlice';
import userReducer from './slices/userSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    processAudit: processAuditReducer,
    ihlr: ihlrReducer,
    tryOut: tryOutReducer,
    user: userReducer,
    notification: notificationReducer,
  },
});

export default store;
