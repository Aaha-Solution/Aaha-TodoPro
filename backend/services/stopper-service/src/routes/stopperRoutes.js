import { Router } from 'express';
import {
  getAllStoppers,
  getActiveStoppers,
  triggerStopper,
  clearStopper
} from '../controllers/stopperController.js';

const router = Router();

router.get('/', getAllStoppers);
router.get('/active', getActiveStoppers);
router.post('/trigger', triggerStopper);
router.put('/clear/:id', clearStopper);
router.post('/clear/:id', clearStopper);

export default router;
