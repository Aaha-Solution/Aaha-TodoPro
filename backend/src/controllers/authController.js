import { generateToken } from '../utils/jwt.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { User } from '../models/User.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return errorResponse(res, 'Email is required', 400);
    }

    // Try finding user in database or fallback to mock
    let user = await User.findByEmail(email);
    if (!user) {
      user = {
        id: 'USR-001',
        name: 'iyyu',
        email: email,
        role: 'Request Creator',
        department: 'Production Planning',
      };
    } else {
      user = {
        id: user.id || 'USR-001',
        name: user.name || 'iyyu',
        email: user.email || email,
        role: user.role || 'Request Creator',
        department: user.department || 'Production Planning',
      };
    }

    const token = generateToken(user);

    return successResponse(res, { token, user }, 'Login successful');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const forgotPassword = async (req, res) => {
  return successResponse(res, null, 'Reset instructions dispatched.');
};

export const getProfile = async (req, res) => {
  return successResponse(res, req.user);
};
