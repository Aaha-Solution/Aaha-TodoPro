/**
 * Realtime Event Dispatcher for INEL Microservices
 * Sends broadcast events to the API Gateway WebSocket Hub (Port 5000)
 */

export const broadcastEvent = async (event, data = {}, room = null) => {
  if (!event) return;
  try {
    const gatewayUrl = (process.env.GATEWAY_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const response = await fetch(`${gatewayUrl}/api/internal/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event, data, room }),
    });

    if (!response.ok) {
      console.warn(`[Realtime Notifier] Gateway broadcast responded with status: ${response.status}`);
    }
  } catch (err) {
    // Non-blocking: realtime failures should never interrupt core database operations
    console.warn(`[Realtime Notifier] Unable to send event '${event}' to gateway:`, err.message);
  }
};

export const notifyUser = async (userId, event, data = {}) => {
  if (!userId) return;
  return broadcastEvent(event, data, `user_${userId}`);
};

export const notifyDepartment = async (department, event, data = {}) => {
  if (!department) return;
  return broadcastEvent(event, data, `dept_${String(department).trim().toUpperCase()}`);
};

export const notifyAll = async (event, data = {}) => {
  return broadcastEvent(event, data, null);
};

export default {
  broadcastEvent,
  notifyUser,
  notifyDepartment,
  notifyAll,
};
