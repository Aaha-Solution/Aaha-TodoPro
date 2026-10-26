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
  testProcessAuditEmail
} from '../controllers/requestController.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.get('/next-id', getNextId);
router.get('/email-logs', getProcessAuditEmailLogs);
router.post('/test-email', testProcessAuditEmail);
router.get('/', getAllRequests);
router.post('/upload', upload.array('files', 15), uploadAttachments);
router.post('/', upload.array('files', 15), createRequest);
router.put('/:id/status', upload.array('files', 15), updateRequestStatus);
router.patch('/:id/status', upload.array('files', 15), updateRequestStatus);
router.put('/:id/reassign', reassignRequest);
router.post('/:id/reassign', reassignRequest);
router.put('/:id', upload.array('files', 15), updateRequest);
router.patch('/:id', upload.array('files', 15), updateRequest);

export default router;

