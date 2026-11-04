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

  const targetDb = customConfig.database || process.env.DB_NAME || 'inel_qtrack';

  const config = {
    host: customConfig.host || process.env.DB_HOST || 'localhost',
    user: customConfig.user || process.env.DB_USER || 'root',
    password: customConfig.password !== undefined ? customConfig.password : (process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '' ? process.env.DB_PASSWORD : ''),
    database: targetDb,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    ...customConfig,
  };

  try {
    pool = mysql.createPool(config);
    pool.query('SET GLOBAL max_allowed_packet = 67108864').catch(() => {}); // 64MB

    const originalQuery = pool.query.bind(pool);
    pool.query = async (...args) => {
      try {
        return await originalQuery(...args);
      } catch (err) {
        if (err.code === 'ER_BAD_DB_ERROR' && config.database === 'inel_qtrack') {
          console.warn('[Database Pool] inel_qtrack not found, falling back to inel_todo...');
          config.database = 'inel_todo';
          pool = mysql.createPool(config);
          return await pool.query(...args);
        }
        throw err;
      }
    };
  } catch (error) {
    console.warn(`[Database Pool] Initialization warning: ${error.message}`);
  }

  return pool;
};

export default getDbPool();
