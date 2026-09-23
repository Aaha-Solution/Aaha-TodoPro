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
  uploadAttachments,
  getBinaryAttachment,
  getBinaryAttachmentByFilename
} from '../controllers/ihlrController.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// File Uploads (Binary Database Storage in MySQL LONGBLOB)
router.post('/upload', upload.array('files', 30), uploadAttachments);

// Stream Binary File from MySQL Database
router.get('/attachments/binary/:id', getBinaryAttachment);
router.get('/attachments/binary/file/:filename', getBinaryAttachmentByFilename);

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
