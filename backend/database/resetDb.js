import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../shared/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function resetDatabase() {
  if (!pool) {
    throw new Error('Database pool not available');
  }

  console.log('[DB Reset] Starting database reset...');

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Split and execute SQL statements
  const executeStatements = async (sqlString, label) => {
    // Remove comments
    const cleanedSql = sqlString
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//gm, '');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (stmt.toLowerCase().startsWith('use ') || stmt.toLowerCase().startsWith('create database')) {
        continue; // Already using connection pool database
      }
      try {
        await pool.query(stmt);
      } catch (err) {
        console.error(`[DB Reset ${label} Error]:`, err.message, '\nStatement:', stmt.substring(0, 100));
        throw err;
      }
    }
  };

  console.log('[DB Reset] Applying schema.sql...');
  await executeStatements(schemaSql, 'SCHEMA');

  const [tables] = await pool.query('SHOW TABLES');
  console.log('[DB Reset] Database reset successful! Active tables in inel_todo:');
  console.log(tables.map(t => Object.values(t)[0]));

  const [users] = await pool.query('SELECT id, name, email, department, role FROM users');
  console.log(`[DB Reset] Seeded ${users.length} enterprise users.`);

  const [requests] = await pool.query('SELECT id, req_no, model, resp, resp_person, status FROM ihlr_requests');
  console.log(`[DB Reset] Initialized ${requests.length} IHLR requests.`);

  const [notifs] = await pool.query('SELECT id, req_no, user_name, title FROM ihlr_notifications');
  console.log(`[DB Reset] Initialized ${notifs.length} dual in-app notifications.`);
}

if (process.argv[1]?.endsWith('resetDb.js')) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
