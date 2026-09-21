import mysql from 'mysql2/promise';
import { ENV } from './env.js';

let pool;

try {
  pool = mysql.createPool({
    host: ENV.DB_HOST,
    user: ENV.DB_USER,
    password: ENV.DB_PASSWORD,
    database: ENV.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
} catch (error) {
  console.warn('MySQL pool initialization deferred (offline/mock mode active)');
}

export default pool;
