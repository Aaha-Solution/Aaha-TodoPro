import { errorResponse } from '../utils/response.js';

export const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthenticated user', 401);
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 'Access forbidden: Insufficient operational permissions', 403);
    }

    next();
  };
};
