import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ihlrRoutes from './routes/ihlrRoutes.js';
import { errorHandler } from '../../../shared/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads folder (images, pdf, word, excel attachments)
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(path.join(uploadsDir, 'attachments'))) {
  fs.mkdirSync(path.join(uploadsDir, 'attachments'), { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/api/ihlr/uploads', express.static(uploadsDir));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'In-House Line Rejection (IHLR) Microservice', port: PORT, timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'In-House Line Rejection (IHLR) Microservice', port: PORT, timestamp: new Date() });
});

// Routes
app.use('/api/ihlr', ihlrRoutes);
app.use('/ihlr', ihlrRoutes);
app.use('/', ihlrRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[IHLR Service] running on http://localhost:${PORT}`);
});

export default app;
