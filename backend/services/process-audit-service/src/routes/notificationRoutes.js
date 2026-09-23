import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController.js';

const router = Router();
router.get('/', getNotifications);
router.patch('/mark-all-read', markAllAsRead);
router.put('/mark-all-read', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.put('/:id/read', markAsRead);

export default router;
