import { Router } from 'express';
import { getNotifications } from '../../controllers/processAudit/notificationController.js';

const router = Router();
router.get('/', getNotifications);

export default router;
