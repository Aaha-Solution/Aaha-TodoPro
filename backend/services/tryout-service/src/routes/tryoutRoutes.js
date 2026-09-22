import { Router } from 'express';
import {
  getDashboardStats,
  getTrialRuns,
  createTrialRun
} from '../controllers/tryoutController.js';

const router = Router();

router.get('/dashboard', getDashboardStats);
router.get('/trials', getTrialRuns);
router.post('/trials', createTrialRun);

export default router;
