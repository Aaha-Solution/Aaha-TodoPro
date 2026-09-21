import { User } from '../../models/User.js';
import { successResponse } from '../../utils/response.js';

export const getUsers = async (req, res) => {
  const users = await User.getAll();
  return successResponse(res, users);
};
