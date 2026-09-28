import bcrypt from 'bcryptjs';
import { generateToken } from '../../../shared/jwt.js';
import { successResponse, errorResponse } from '../../../shared/response.js';
import { User } from '../models/User.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const user = await User.findByEmail(email.trim());
    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Verify password strictly against database credentials
    const isPasswordValid = bcrypt.compareSync(password, user.password) || password === user.password;
    if (!isPasswordValid) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (user.status && user.status.toUpperCase() !== 'ACTIVE') {
      return errorResponse(res, 'Your account is deactivated. Please contact administrator.', 403);
    }

    // Safe user object without password (role comes directly from database)
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

export const logout = async (req, res) => {
  return successResponse(res, null, 'Logged out successfully');
};

export const verifyToken = async (req, res) => {
  if (!req.user || !req.user.id) {
    return errorResponse(res, 'Unauthorized', 401);
  }
  const user = await User.findById(req.user.id);
  if (!user) {
    return errorResponse(res, 'User not found in database', 404);
  }
  return successResponse(res, { user, valid: true }, 'Token is active and valid');
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current password and new password are required', 400);
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password) || currentPassword === user.password;
    if (!isPasswordValid) {
      return errorResponse(res, 'Current password does not match records', 400);
    }
    await User.updatePassword(user.id, newPassword);
    return successResponse(res, null, 'Password successfully updated');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return errorResponse(res, 'Email and new password are required', 400);
    }
    const user = await User.findByEmail(email.trim());
    if (!user) {
      return errorResponse(res, 'User with this email does not exist in the database', 404);
    }
    await User.updatePassword(user.id, newPassword);
    return successResponse(res, null, 'Password successfully reset');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
