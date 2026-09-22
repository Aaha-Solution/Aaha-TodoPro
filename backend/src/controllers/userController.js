import { User } from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    return successResponse(res, users, 'Users retrieved successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    return successResponse(res, user);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, role, department, status, systems, employeeId } = req.body;
    if (!name || !email) {
      return errorResponse(res, 'Name and Email are required', 400);
    }

    const newUser = await User.create({
      name,
      email,
      role: role || 'Request Creator',
      department: department || 'Production Planning',
      status: status || 'Active',
      systems: systems || ['processAudit'],
      employeeId
    });

    return successResponse(res, newUser, 'User created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await User.update(id, req.body);
    if (!updated) {
      return errorResponse(res, 'User not found', 404);
    }
    return successResponse(res, updated, 'User updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.delete(id);
    return successResponse(res, { id }, 'User deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
