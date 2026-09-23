import { Router } from 'express';
import { getAllApprovals, getApprovalByRequestId } from '../controllers/approvalController.js';

const router = Router();

router.get('/', getAllApprovals);
router.get('/:id', getApprovalByRequestId);

export default router;
