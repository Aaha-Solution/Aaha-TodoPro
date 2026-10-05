import jwt from 'jsonwebtoken';

const getSecret = () => process.env.JWT_SECRET || 'inel_todo_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (payload) => {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getSecret());
  } catch (err) {
    return jwt.verify(token, 'inel_todo_secret_key_2026');
  }
};
