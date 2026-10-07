import { io } from 'socket.io-client';
import { getGatewayBaseUrl } from './api';
import { storage } from '../utils/storage';

let socket = null;

/**
 * Initializes and returns the singleton Socket.IO client instance.
 * Automatically targets the current network/localhost Gateway (Port 5000).
 */
export const getSocket = () => {
  if (!socket) {
    const gatewayUrl = getGatewayBaseUrl();
    const token = storage.getToken();

    socket = io(gatewayUrl, {
      autoConnect: true,
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log(`[Socket.IO] Connected to Gateway WebSocket (${gatewayUrl}) with ID: ${socket.id}`);
      identifyCurrentUser();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO Connection Warning]:', err.message);
    });
  }
  return socket;
};

/**
 * Emits user info to join user-specific and department-specific socket rooms
 */
export const identifyCurrentUser = (userParam) => {
  if (!socket || !socket.connected) return;
  const user = userParam || storage.getUser();
  if (user) {
    socket.emit('identify', {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
    });
  }
};

/**
 * Cleanly disconnects the socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Subscribe to a socket event
 */
export const subscribeToEvent = (event, callback) => {
  const s = getSocket();
  s.on(event, callback);
  return () => s.off(event, callback);
};

/**
 * Emit an event through the socket
 */
export const emitEvent = (event, data) => {
  const s = getSocket();
  s.emit(event, data);
};

export default {
  getSocket,
  identifyCurrentUser,
  disconnectSocket,
  subscribeToEvent,
  emitEvent,
};
