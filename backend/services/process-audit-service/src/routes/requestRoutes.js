import { Router } from 'express';
import { getAllRequests, createRequest, getNextId, uploadAttachments } from '../controllers/requestController.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.get('/next-id', getNextId);
router.get('/', getAllRequests);
router.post('/upload', upload.array('files', 15), uploadAttachments);
router.post('/', upload.array('files', 15), createRequest);

export default router;
