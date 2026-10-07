import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket, identifyCurrentUser, disconnectSocket } from '../services/socket';
import { useAuthContext } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuthContext();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      if (user) {
        identifyCurrentUser(user);
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    if (socket.connected) {
      setIsConnected(true);
      if (user) identifyCurrentUser(user);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Global listener for backend notifications refresh
    const handleNotificationsRefresh = (data) => {
      // Dispatches browser-wide event so all listening components (Header bell, notification drawer, tabs) refresh immediately
      window.dispatchEvent(new CustomEvent('websocketNotification', { detail: data }));
      window.dispatchEvent(new Event('refreshNotifications'));
    };

    const handleIhlrLiveUpdate = (data) => {
      window.dispatchEvent(new CustomEvent('ihlrLiveUpdate', { detail: data }));
      window.dispatchEvent(new Event('refreshNotifications'));
    };

    const handleProcessAuditLiveUpdate = (data) => {
      window.dispatchEvent(new CustomEvent('processAuditLiveUpdate', { detail: data }));
      window.dispatchEvent(new Event('refreshNotifications'));
    };

    socket.on('notifications:refresh', handleNotificationsRefresh);
    socket.on('ihlr:created', handleIhlrLiveUpdate);
    socket.on('ihlr:updated', handleIhlrLiveUpdate);
    socket.on('ihlr:deleted', handleIhlrLiveUpdate);
    socket.on('process_audit:created', handleProcessAuditLiveUpdate);
    socket.on('process_audit:updated', handleProcessAuditLiveUpdate);
    socket.on('process_audit:reassigned', handleProcessAuditLiveUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notifications:refresh', handleNotificationsRefresh);
      socket.off('ihlr:created', handleIhlrLiveUpdate);
      socket.off('ihlr:updated', handleIhlrLiveUpdate);
      socket.off('ihlr:deleted', handleIhlrLiveUpdate);
      socket.off('process_audit:created', handleProcessAuditLiveUpdate);
      socket.off('process_audit:updated', handleProcessAuditLiveUpdate);
      socket.off('process_audit:reassigned', handleProcessAuditLiveUpdate);
    };
  }, []);

  // Sync user room joins when user profile or authentication changes
  useEffect(() => {
    if (user && isAuthenticated) {
      identifyCurrentUser(user);
    } else if (!isAuthenticated) {
      // optional: do not disconnect immediately if general updates needed, but re-identify
    }
  }, [user, isAuthenticated]);

  return (
    <SocketContext.Provider
      value={{
        socket: getSocket(),
        isConnected,
        emit: (event, data) => getSocket().emit(event, data),
        on: (event, cb) => getSocket().on(event, cb),
        off: (event, cb) => getSocket().off(event, cb),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
