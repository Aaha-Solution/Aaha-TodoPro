import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));

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
      lineStoppers: process.env.STOPPER_SERVICE_URL || 'http://localhost:5005',
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
const stopperServiceUrl = process.env.STOPPER_SERVICE_URL || 'http://localhost:5005';

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

// 5. Line Stopper Service (:5005)
app.use(
  createProxyMiddleware({
    target: stopperServiceUrl,
    changeOrigin: true,
    pathFilter: '/api/line-stoppers',
    on: {
      error: proxyErrorHandler('Line Stopper Service (Port 5005)'),
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

app.listen(PORT, () => {
  console.log(`[INEL API Gateway] running on http://localhost:${PORT}`);
  console.log(`[Gateway Routing Matrix]`);
  console.log(` -> /api/auth          => ${authServiceUrl}`);
  console.log(` -> /api/users         => ${authServiceUrl}`);
  console.log(` -> /api/process-audit => ${processAuditServiceUrl}`);
  console.log(` -> /api/ihlr          => ${ihlrServiceUrl}`);
  console.log(` -> /api/tryout-status => ${tryoutServiceUrl}`);
  console.log(` -> /api/line-stoppers => ${stopperServiceUrl}`);
});

export default app;
