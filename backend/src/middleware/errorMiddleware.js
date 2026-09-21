import { errorResponse } from '../utils/response.js';

export const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]:', err.stack || err.message);
  const status = err.status || 500;
  return errorResponse(res, err.message || 'Internal Server Error', status);
};
