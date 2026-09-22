import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import tryoutRoutes from './routes/tryoutRoutes.js';
import { errorHandler } from '../../../shared/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Try Out Status (Tool & Die Trial) Microservice', port: PORT, timestamp: new Date() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Try Out Status (Tool & Die Trial) Microservice', port: PORT, timestamp: new Date() });
});

// Routes
app.use('/api/tryout-status', tryoutRoutes);
app.use('/tryout-status', tryoutRoutes);
app.use('/', tryoutRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Try Out Status Service] running on http://localhost:${PORT}`);
});

export default app;
