import { Router } from 'express';
import { 
  login, 
  logout, 
  forgotPassword, 
  resetPassword, 
  changePassword, 
  getProfile, 
  verifyToken 
} from '../controllers/authController.js';
import { authenticate } from '../../../shared/authMiddleware.js';

const router = Router();

// Public auth endpoints
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected auth endpoints
router.get('/profile', authenticate, getProfile);
router.get('/me', authenticate, getProfile);
router.get('/verify', authenticate, verifyToken);
router.post('/change-password', authenticate, changePassword);

export default router;
