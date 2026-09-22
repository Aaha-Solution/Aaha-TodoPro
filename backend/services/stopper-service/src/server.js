import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import stopperRoutes from './routes/stopperRoutes.js';
import { errorHandler } from '../../../shared/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Emergency Line Stopper Microservice', port: PORT, timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Emergency Line Stopper Microservice', port: PORT, timestamp: new Date() });
});

// Routes
app.use('/api/line-stoppers', stopperRoutes);
app.use('/line-stoppers', stopperRoutes);
app.use('/', stopperRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Line Stopper Service] running on http://localhost:${PORT}`);
});

export default app;
