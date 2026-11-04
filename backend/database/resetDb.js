import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
} catch (e) {}

export async function resetDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const dbName = process.env.DB_NAME || 'inel_qtrack';

  console.log('[DB Reset] Starting database reset...');
  console.log(`[DB Reset] Connecting to MySQL server (${host}:${port}) to ensure database "${dbName}" exists...`);

  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host,
      user,
      password,
      port,
      multipleStatements: true,
    });
  } catch (connErr) {
    console.error(`[DB Reset Connection Error] Could not connect to MySQL server at ${host}:${port}:`, connErr.message);
    throw connErr;
  }

  // 1. Create target database if it does not exist
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await rootConn.query(`USE \`${dbName}\`;`);
  console.log(`[DB Reset] Database "${dbName}" verified and selected.`);

  // 2. Read schema.sql
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[DB Reset] Applying schema.sql...');

  // Strip SQL comments
  const cleanedSql = schemaSql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//gm, '');

  const statements = cleanedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    // Skip redundant database create/use statements since rootConn is already in target db
    if (stmt.toLowerCase().startsWith('use ') || stmt.toLowerCase().startsWith('create database')) {
      continue;
    }
    try {
      await rootConn.query(stmt);
    } catch (err) {
      console.error(`[DB Reset SCHEMA Error]:`, err.message, '\nStatement:', stmt.substring(0, 100));
      await rootConn.end();
      throw err;
    }
  }

  const [tables] = await rootConn.query('SHOW TABLES');
  console.log(`[DB Reset] Database reset successful! Active tables in ${dbName}:`);
  console.log(tables.map(t => Object.values(t)[0]));

  const [users] = await rootConn.query('SELECT id, name, email, department, role FROM users');
  console.log(`[DB Reset] Seeded ${users.length} enterprise users.`);

  const [requests] = await rootConn.query('SELECT id, req_no, model, resp, resp_person, status FROM ihlr_requests');
  console.log(`[DB Reset] Initialized ${requests.length} IHLR requests.`);

  const [notifs] = await rootConn.query('SELECT id, req_no, user_name, title FROM ihlr_notifications');
  console.log(`[DB Reset] Initialized ${notifs.length} dual in-app notifications.`);

  await rootConn.end();
}

if (process.argv[1]?.endsWith('resetDb.js')) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
