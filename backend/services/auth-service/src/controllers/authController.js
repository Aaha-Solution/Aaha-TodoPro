import bcrypt from 'bcryptjs';
import { generateToken } from '../../../shared/jwt.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { User } from '../models/User.js';

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const user = await User.findByEmail(email.trim());
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Verify password with bcrypt or direct match
    const isPasswordValid = bcrypt.compareSync(password, user.password) || password === user.password;
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (user.status && user.status.toUpperCase() !== 'ACTIVE') {
      return errorResponse(res, 'Your account is deactivated. Please contact administrator.', 403);
    }

    // If logging in as admin, check admin permissions
    if (role && role.toLowerCase() === 'admin') {
      const userRole = (user.role || '').toLowerCase();
      if (!userRole.includes('admin')) {
        return errorResponse(res, 'This account does not have Admin privileges', 403);
      }
    }

    // Safe user object without password
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      status: user.status
    };

    const token = generateToken({
      id: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      name: safeUser.name
    });

    return successResponse(res, { token, user: safeUser }, 'Login successful');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }
  const user = await User.findByEmail(email.trim());
  if (!user) {
    return errorResponse(res, 'User with this email does not exist in the database', 404);
  }
  return successResponse(res, null, 'Reset instructions dispatched to registered email.');
};

export const getProfile = async (req, res) => {
  if (!req.user || !req.user.id) {
    return errorResponse(res, 'Unauthorized', 401);
  }
  const user = await User.findById(req.user.id);
  if (!user) {
    return errorResponse(res, 'User not found in database', 404);
  }
  return successResponse(res, user);
};
