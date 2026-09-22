import { Router } from 'express';
import { getAllRequests, createRequest } from '../controllers/requestController.js';

const router = Router();
router.get('/', getAllRequests);
router.post('/', createRequest);

export default router;
