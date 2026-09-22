import { Router } from 'express';
import {
  getDashboardStats,
  getLineRejections,
  createLineRejection,
  getScrapMonitoring
} from '../controllers/ihlrController.js';

const router = Router();

router.get('/dashboard', getDashboardStats);
router.get('/line-rejections', getLineRejections);
router.post('/line-rejections', createLineRejection);
router.get('/scrap', getScrapMonitoring);

export default router;
