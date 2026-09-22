import { errorResponse } from './response.js';

export const errorHandler = (err, req, res, next) => {
  console.error(`[Error Handler] ${req.method} ${req.url}:`, err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  return errorResponse(res, message, status);
};
