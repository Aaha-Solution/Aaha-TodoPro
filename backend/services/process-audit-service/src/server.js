import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dashboardRoutes from './routes/dashboardRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import { getAttachment, downloadAttachment } from './controllers/attachmentController.js';
import { ensureAttachmentTable, migrateDiskFilesIfAny } from './models/Attachment.js';
import { errorHandler } from '../../../shared/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize attachment database table and migrate any past disk files into MySQL
ensureAttachmentTable().then(() => migrateDiskFilesIfAny()).catch(err => {
  console.warn('[Process Audit Service] Attachment init warning:', err.message);
});

// Stream legacy disk paths directly from MySQL binary table as fallback
app.get('/api/process-audit/uploads/attachments/:filename(*)', getAttachment);
app.get('/uploads/attachments/:filename(*)', getAttachment);

// Static uploads folder fallback (if any other static assets exist)
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/api/process-audit/uploads', express.static(uploadsDir));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Process Audit Observation Microservice', port: PORT, timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Process Audit Observation Microservice', port: PORT, timestamp: new Date() });
});

// Mount routes
const mountRoutes = (prefix = '') => {
  app.use(`${prefix}/dashboard`, dashboardRoutes);
  app.use(`${prefix}/requests`, requestRoutes);
  app.use(`${prefix}/attachments`, attachmentRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/approvals`, approvalRoutes);
};

mountRoutes('/api/process-audit');
mountRoutes('');

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Process Audit Service] running on http://localhost:${PORT}`);
});

export default app;
