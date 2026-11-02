import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import processAuditRoutes from './routes/processAuditRoutes.js';
import { errorHandler } from '../../../shared/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads folder (images, pdf, word, excel attachments)
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(path.join(uploadsDir, 'attachments'))) {
  fs.mkdirSync(path.join(uploadsDir, 'attachments'), { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/api/process-audit/uploads', express.static(uploadsDir));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Process Audit Observation Microservice', port: PORT, timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Process Audit Observation Microservice', port: PORT, timestamp: new Date() });
});

// Routes (Mirrors IHLR Service Pattern)
app.use('/api/process-audit', processAuditRoutes);
app.use('/process-audit', processAuditRoutes);
app.use('/', processAuditRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Process Audit Service] running on http://localhost:${PORT}`);
});

export default app;
