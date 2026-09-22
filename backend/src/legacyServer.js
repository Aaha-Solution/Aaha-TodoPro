import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorMiddleware.js';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/processAudit/dashboardRoutes.js';
import requestRoutes from './routes/processAudit/requestRoutes.js';
import notificationRoutes from './routes/processAudit/notificationRoutes.js';
import userRoutes from './routes/processAudit/userRoutes.js';
import commonUserRoutes from './routes/userRoutes.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'INEL Todo Legacy Monolith API', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', commonUserRoutes);
app.use('/api/process-audit/dashboard', dashboardRoutes);
app.use('/api/process-audit/requests', requestRoutes);
app.use('/api/process-audit/notifications', notificationRoutes);
app.use('/api/process-audit/users', userRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = ENV.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[INEL Legacy Monolithic Server] running on http://localhost:${PORT}`);
});

export default app;
