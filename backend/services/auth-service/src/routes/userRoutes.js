import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  checkEmployeeIdExists
} from '../controllers/userController.js';

const router = Router();

router.get('/', getUsers);
router.get('/check-emp-id', checkEmployeeIdExists);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
