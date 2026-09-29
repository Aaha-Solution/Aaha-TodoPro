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
    password: customConfig.password !== undefined ? customConfig.password : (process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '' ? process.env.DB_PASSWORD : ''),
    database: customConfig.database || process.env.DB_NAME || 'inel_todo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...customConfig,
  };

  try {
    pool = mysql.createPool(config);

    // Increase MySQL server max_allowed_packet to 1GB to support large file uploads (LONGBLOB)
    // Run SET GLOBAL on a dedicated standalone connection so all subsequent pool connections inherit the 1GB limit
    (async () => {
      try {
        const initConn = await mysql.createConnection({
          host: config.host,
          user: config.user,
          password: config.password,
          database: config.database,
          port: config.port,
        });
        await initConn.query('SET GLOBAL max_allowed_packet = 1073741824'); // 1GB
        await initConn.end();
      } catch (err) {
        pool.query('SET GLOBAL max_allowed_packet = 1073741824').catch(() => {});
      }
    })();
  } catch (error) {
    console.warn(`[Database Pool] Initialization warning: ${error.message}`);
  }

  return pool;
};

export default getDbPool();
