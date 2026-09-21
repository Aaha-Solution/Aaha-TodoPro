import { Router } from 'express';
import { getDashboardMetrics } from '../../controllers/processAudit/dashboardController.js';

const router = Router();
router.get('/', getDashboardMetrics);

export default router;
