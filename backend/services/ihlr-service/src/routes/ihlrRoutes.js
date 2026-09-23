import { Router } from 'express';
import {
  getDashboardStats,
  getIhlrRequests,
  getIhlrRequestById,
  createIhlrRequest,
  updateIhlrRequest,
  deleteIhlrRequest,
  getIhlrNotifications,
  getNextReqNo
} from '../controllers/ihlrController.js';

const router = Router();

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
