import { User } from '../models/User.js';
import { successResponse, errorResponse } from '../../../shared/response.js';

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

export const checkEmployeeIdExists = async (req, res) => {
  try {
    const { employeeId, excludeId } = req.query;
    if (!employeeId || !String(employeeId).trim()) {
      return successResponse(res, { exists: false });
    }

    const trimmed = String(employeeId).trim();
    let existing;
    if (excludeId) {
      existing = await User.findByEmployeeIdExcludingUser(trimmed, excludeId);
    } else {
      existing = await User.findByEmployeeId(trimmed);
    }

    return successResponse(res, {
      exists: !!existing,
      employeeId: trimmed,
      userName: existing ? existing.name : null
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, status, systems, employeeId } = req.body;
    if (!name || !email) {
      return errorResponse(res, 'Name and Email are required', 400);
    }

    if (employeeId && String(employeeId).trim()) {
      const trimmedEmpId = String(employeeId).trim();
      const existingEmp = await User.findByEmployeeId(trimmedEmpId);
      if (existingEmp) {
        return errorResponse(res, `Employee ID "${trimmedEmpId}" already exists in database (assigned to ${existingEmp.name})`, 400);
      }
    }

    const existingEmail = await User.findByEmail(email.trim());
    if (existingEmail) {
      return errorResponse(res, `Email "${email.trim()}" is already registered in database`, 400);
    }

    const normalizedRole = (role && role.toUpperCase() === 'ADMIN') ? 'ADMIN' : 'USER';

    const newUser = await User.create({
      name,
      email,
      password: password || 'PlantUser@123',
      role: normalizedRole,
      department: department || 'PRODUCTION',
      status: status ? status.toUpperCase() : 'ACTIVE',
      systems: systems || ['processAudit'],
      employeeId
    });

    return successResponse(res, newUser, 'User created successfully', 201);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('employee_id') || error.message.includes('idx_user_employee_id')) {
        return errorResponse(res, 'Employee ID is already registered in database', 400);
      }
      return errorResponse(res, 'Email or Employee ID is already registered in database', 400);
    }
    return errorResponse(res, error.message, 500);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    if (employeeId && String(employeeId).trim()) {
      const trimmedEmpId = String(employeeId).trim();
      const duplicateEmp = await User.findByEmployeeIdExcludingUser(trimmedEmpId, id);
      if (duplicateEmp) {
        return errorResponse(res, `Employee ID "${trimmedEmpId}" already exists in database (assigned to ${duplicateEmp.name})`, 400);
      }
    }

    const updated = await User.update(id, req.body);
    if (!updated) {
      return errorResponse(res, 'User not found', 404);
    }
    return successResponse(res, updated, 'User updated successfully');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('employee_id') || error.message.includes('idx_user_employee_id')) {
        return errorResponse(res, 'Employee ID is already registered in database', 400);
      }
      return errorResponse(res, 'Duplicate entry in database', 400);
    }
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
