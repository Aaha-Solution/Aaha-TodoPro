import { Router } from 'express';
import {
  getAllRequests,
  createRequest,
  getNextId,
  uploadAttachments,
  updateRequestStatus,
  reassignRequest,
  updateRequest,
  getProcessAuditEmailLogs,
  testProcessAuditEmail,
  getNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  getDashboardMetrics,
  getAllApprovals,
  getApprovalByRequestId,
  getUsers,
  getAttachment,
  downloadAttachment,
  getAttachmentInfo
} from '../controllers/processAuditController.js';
import { upload } from '../middleware/upload.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = Router();

// Apply auth middleware to all Process Audit routes (matching IHLR architecture)
router.use(authenticateUser);

// Next Request ID / Number
router.get('/next-id', getNextId);
router.get('/requests/next-id', getNextId);
router.get('/next-req-no', getNextId);

// Uploads & Attachments
router.post('/upload', upload.array('files', 15), uploadAttachments);
router.post('/requests/upload', upload.array('files', 15), uploadAttachments);
router.get('/attachments/download/:filename(*)', downloadAttachment);
router.get('/attachments/info/:id', getAttachmentInfo);
router.get('/attachments/db/:id', getAttachment);
router.get('/attachments/stream/:id', getAttachment);
router.get('/attachments/:filename(*)', getAttachment);

// Dashboard & KPI
router.get('/dashboard', getDashboardMetrics);

// Requests
router.get('/requests', getAllRequests);
router.post('/requests', upload.array('files', 15), createRequest);
router.put('/requests/:id/status', upload.array('files', 15), updateRequestStatus);
router.patch('/requests/:id/status', upload.array('files', 15), updateRequestStatus);
router.put('/requests/:id/reassign', reassignRequest);
router.post('/requests/:id/reassign', reassignRequest);
router.put('/requests/:id', upload.array('files', 15), updateRequest);
router.patch('/requests/:id', upload.array('files', 15), updateRequest);

// Approvals
router.get('/approvals', getAllApprovals);
router.get('/approvals/:id', getApprovalByRequestId);

// Users
router.get('/users', getUsers);

// Activity & Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/mark-all-read', markAllAsRead);
router.put('/notifications/mark-all-read', markAllAsRead);
router.patch('/notifications/:id/read', markAsRead);
router.put('/notifications/:id/read', markAsRead);
router.patch('/notifications/:id/unread', markAsUnread);
router.put('/notifications/:id/unread', markAsUnread);

// Email Audit Logs & Testing
router.get('/email-logs', getProcessAuditEmailLogs);
router.get('/requests/email-logs', getProcessAuditEmailLogs);
router.post('/test-email', testProcessAuditEmail);
router.post('/requests/test-email', testProcessAuditEmail);

export default router;
