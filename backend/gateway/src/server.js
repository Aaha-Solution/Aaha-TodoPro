import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));

// Initialize Socket.IO Real-time WebSocket Hub
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Client user identification to join user-specific and department-specific rooms
  socket.on('identify', (userData) => {
    if (userData?.id) {
      const userRoom = `user_${userData.id}`;
      socket.join(userRoom);
      console.log(`[Socket.IO] Socket ${socket.id} joined user room: ${userRoom}`);
    }
    if (userData?.department) {
      const deptRoom = `dept_${String(userData.department).trim().toUpperCase()}`;
      socket.join(deptRoom);
      console.log(`[Socket.IO] Socket ${socket.id} joined department room: ${deptRoom}`);
    }
  });

  socket.on('join_room', (roomName) => {
    if (roomName) {
      socket.join(roomName);
      console.log(`[Socket.IO] Socket ${socket.id} joined room: ${roomName}`);
    }
  });

  socket.on('leave_room', (roomName) => {
    if (roomName) {
      socket.leave(roomName);
      console.log(`[Socket.IO] Socket ${socket.id} left room: ${roomName}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// Internal Realtime Broadcast endpoint (used by downstream microservices)
app.post('/api/internal/broadcast', express.json(), (req, res) => {
  try {
    const { event, data, room } = req.body;
    if (!event) {
      return res.status(400).json({ success: false, message: 'Event name is required' });
    }

    if (room) {
      io.to(room).emit(event, data);
      console.log(`[Socket.IO Broadcast] Emitted '${event}' to room '${room}'`);
    } else {
      io.emit(event, data);
      console.log(`[Socket.IO Broadcast] Broadcasted '${event}' to all clients`);
    }

    return res.json({ success: true, delivered: true, event });
  } catch (err) {
    console.error('[Socket.IO Broadcast Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Health Check & Gateway Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'INEL API Gateway',
    timestamp: new Date().toISOString(),
    routes: {
      auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
      users: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
      processAudit: process.env.PROCESS_AUDIT_SERVICE_URL || 'http://localhost:5002',
      ihlr: process.env.IHLR_SERVICE_URL || 'http://localhost:5003',
      tryoutStatus: process.env.TRYOUT_SERVICE_URL || 'http://localhost:5004',
    }
  });
});

// Proxy error helper
const proxyErrorHandler = (serviceName) => (err, req, res) => {
  console.error(`[Gateway Proxy Error] ${serviceName} unreachable:`, err.message);
  if (!res.headersSent) {
    res.status(503).json({
      success: false,
      message: `The ${serviceName} is currently unavailable or restarting. Please ensure the microservice is running.`,
      error: err.message,
    });
  }
};

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const processAuditServiceUrl = process.env.PROCESS_AUDIT_SERVICE_URL || 'http://localhost:5002';
const ihlrServiceUrl = process.env.IHLR_SERVICE_URL || 'http://localhost:5003';
const tryoutServiceUrl = process.env.TRYOUT_SERVICE_URL || 'http://localhost:5004';

// 1. Auth & User Management Service (:5001)
app.use(
  createProxyMiddleware({
    target: authServiceUrl,
    changeOrigin: true,
    pathFilter: ['/api/auth', '/api/users'],
    on: {
      error: proxyErrorHandler('Auth & User Service (Port 5001)'),
    },
  })
);

// 2. Process Audit Service (:5002)
app.use(
  createProxyMiddleware({
    target: processAuditServiceUrl,
    changeOrigin: true,
    pathFilter: '/api/process-audit',
    on: {
      error: proxyErrorHandler('Process Audit Service (Port 5002)'),
    },
  })
);

// 3. IHLR Service (:5003)
app.use(
  createProxyMiddleware({
    target: ihlrServiceUrl,
    changeOrigin: true,
    pathFilter: '/api/ihlr',
    on: {
      error: proxyErrorHandler('IHLR Service (Port 5003)'),
    },
  })
);

// 4. Try Out Status Service (:5004)
app.use(
  createProxyMiddleware({
    target: tryoutServiceUrl,
    changeOrigin: true,
    pathFilter: '/api/tryout-status',
    on: {
      error: proxyErrorHandler('Try Out Status Service (Port 5004)'),
    },
  })
);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found on gateway: ${req.method} ${req.url}`,
  });
});

const getLocalIp = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`[INEL API Gateway + WebSocket] running on:`);
  console.log(`  > Local:   http://localhost:${PORT}`);
  console.log(`  > Network: http://${localIp}:${PORT}`);
  console.log(`  > WebSocket: ws://localhost:${PORT}`);
  console.log(`[Gateway Routing Matrix]`);
  console.log(` -> /api/auth          => ${authServiceUrl}`);
  console.log(` -> /api/users         => ${authServiceUrl}`);
  console.log(` -> /api/process-audit => ${processAuditServiceUrl}`);
  console.log(` -> /api/ihlr          => ${ihlrServiceUrl}`);
  console.log(` -> /api/tryout-status => ${tryoutServiceUrl}`);
});

export { app, server, io };
export default app;
