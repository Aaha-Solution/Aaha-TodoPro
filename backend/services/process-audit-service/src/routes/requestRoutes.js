import { Router } from 'express';
import { getAllRequests, createRequest, getNextId } from '../controllers/requestController.js';

const router = Router();
router.get('/next-id', getNextId);
router.get('/', getAllRequests);
router.post('/', createRequest);

export default router;
