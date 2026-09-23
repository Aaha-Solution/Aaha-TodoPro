import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  dotenv.config();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} catch (e) {}

let pool = null;

export const getDbPool = (customConfig = {}) => {
  if (pool) return pool;

  const config = {
    host: customConfig.host || process.env.DB_HOST || 'localhost',
    user: customConfig.user || process.env.DB_USER || 'root',
    password: customConfig.password !== undefined ? customConfig.password : (process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '' ? process.env.DB_PASSWORD : '2002'),
    database: customConfig.database || process.env.DB_NAME || 'inel_todo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...customConfig,
  };

  try {
    pool = mysql.createPool(config);
  } catch (error) {
    console.warn(`[Database Pool] Initialization warning: ${error.message}`);
  }

  return pool;
};

export default getDbPool();
