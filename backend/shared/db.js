import mysql from 'mysql2/promise';

let pool = null;

export const getDbPool = (customConfig = {}) => {
  if (pool) return pool;

  const config = {
    host: customConfig.host || process.env.DB_HOST || 'localhost',
    user: customConfig.user || process.env.DB_USER || 'root',
    password: customConfig.password || process.env.DB_PASSWORD || '',
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
