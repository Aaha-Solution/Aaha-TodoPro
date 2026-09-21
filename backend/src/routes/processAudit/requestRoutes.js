import { Router } from 'express';
import { getAllRequests, createRequest } from '../../controllers/processAudit/requestController.js';

const router = Router();
router.get('/', getAllRequests);
router.post('/', createRequest);

export default router;
