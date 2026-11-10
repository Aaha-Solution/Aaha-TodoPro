import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuthContext } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuthContext();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let teardown = null;

    import('../services/socket').then(({ getSocket, identifyCurrentUser }) => {
      if (cancelled) return;
      const socket = getSocket();
      socketRef.current = socket;

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
        window.dispatchEvent(new CustomEvent('websocketNotification', { detail: data }));
        window.dispatchEvent(new Event('refreshNotifications'));
      };

      const handleIhlrLiveUpdate = (data) => {
        window.dispatchEvent(new CustomEvent('ihlrLiveUpdate', { detail: data }));
      };

      const handleProcessAuditLiveUpdate = (data) => {
        window.dispatchEvent(new CustomEvent('processAuditLiveUpdate', { detail: data }));
      };

      socket.on('notifications:refresh', handleNotificationsRefresh);
      socket.on('ihlr:created', handleIhlrLiveUpdate);
      socket.on('ihlr:updated', handleIhlrLiveUpdate);
      socket.on('ihlr:deleted', handleIhlrLiveUpdate);
      socket.on('process_audit:created', handleProcessAuditLiveUpdate);
      socket.on('process_audit:updated', handleProcessAuditLiveUpdate);
      socket.on('process_audit:reassigned', handleProcessAuditLiveUpdate);

      teardown = () => {
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
    });

    return () => {
      cancelled = true;
      if (teardown) teardown();
    };
  }, [isAuthenticated]);

  // Sync user room joins when user profile or authentication changes
  useEffect(() => {
    if (user && isAuthenticated && socketRef.current?.connected) {
      import('../services/socket').then(({ identifyCurrentUser }) => {
        identifyCurrentUser(user);
      });
    }
  }, [user, isAuthenticated]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        emit: (event, data) => socketRef.current?.emit(event, data),
        on: (event, cb) => socketRef.current?.on(event, cb),
        off: (event, cb) => socketRef.current?.off(event, cb),
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

export { SocketContext };
export default SocketProvider;
