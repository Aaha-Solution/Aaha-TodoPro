import { Router } from 'express';
import { getUsers } from '../../controllers/processAudit/userController.js';

const router = Router();
router.get('/', getUsers);

export default router;
