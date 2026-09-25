import { Router } from 'express';
import {
  getDashboardStats,
  getIhlrRequests,
  getIhlrRequestById,
  createIhlrRequest,
  updateIhlrRequest,
  deleteIhlrRequest,
  getIhlrNotifications,
  markIhlrNotificationRead,
  markAllIhlrNotificationsRead,
  getNextReqNo,
  uploadAttachments,
  getBinaryAttachment,
  getBinaryAttachmentByFilename
} from '../controllers/ihlrController.js';
import { uploadMemory } from '../../../shared/binaryStorage.js';

const router = Router();

// File Uploads (Binary Database Storage in MySQL LONGBLOB via Shared Module)
router.post('/upload', uploadMemory.array('files', 30), uploadAttachments);

// Stream Binary File from MySQL Database
router.get('/attachments/binary/:id', getBinaryAttachment);
router.get('/attachments/binary/file/:filename', getBinaryAttachmentByFilename);
router.get('/attachments/:id', getBinaryAttachment);
router.get('/attachments/file/:filename', getBinaryAttachmentByFilename);

// Next Request Number
router.get('/next-req-no', getNextReqNo);

// Dashboard & KPI
router.get('/dashboard', getDashboardStats);

// IHLR Analysis Requests
router.get('/requests', getIhlrRequests);
router.get('/requests/:id', getIhlrRequestById);
router.post('/requests', createIhlrRequest);
router.put('/requests/:id', updateIhlrRequest);
router.delete('/requests/:id', deleteIhlrRequest);

// Activity & Notifications
router.get('/notifications', getIhlrNotifications);
router.patch('/notifications/:id/read', markIhlrNotificationRead);
router.patch('/notifications/mark-all-read', markAllIhlrNotificationsRead);

// Backward compatibility alias
router.get('/line-rejections', getIhlrRequests);
router.post('/line-rejections', createIhlrRequest);

export default router;
