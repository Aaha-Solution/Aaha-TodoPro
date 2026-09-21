import { errorResponse } from '../utils/response.js';

export const validate = (schemaFn) => {
  return (req, res, next) => {
    const { error } = schemaFn(req.body);
    if (error) {
      return errorResponse(res, 'Validation error', 400, error);
    }
    next();
  };
};
