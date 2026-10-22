import { Router } from 'express';
import { getNotifications, markAsRead, markAsUnread, markAllAsRead } from '../controllers/notificationController.js';

const router = Router();
router.get('/', getNotifications);
router.patch('/mark-all-read', markAllAsRead);
router.put('/mark-all-read', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.put('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);
router.put('/:id/unread', markAsUnread);

export default router;
