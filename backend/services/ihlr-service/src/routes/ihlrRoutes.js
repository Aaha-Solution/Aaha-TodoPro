import { Router } from 'express';
import {
  getDashboardStats,
  getIhlrRequests,
  getIhlrRequestById,
  createIhlrRequest,
  updateIhlrRequest,
  deleteIhlrRequest,
  getIhlrNotifications,
  getNextReqNo,
  uploadAttachments
} from '../controllers/ihlrController.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// File Uploads (Images, PDF, Word, Excel)
router.post('/upload', upload.array('files', 30), uploadAttachments);

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

// Backward compatibility alias
router.get('/line-rejections', getIhlrRequests);
router.post('/line-rejections', createIhlrRequest);

export default router;
