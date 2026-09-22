import { Router } from 'express';
import { login, forgotPassword, getProfile } from '../controllers/authController.js';
import { authenticate } from '../../../shared/authMiddleware.js';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/profile', authenticate, getProfile);

export default router;
