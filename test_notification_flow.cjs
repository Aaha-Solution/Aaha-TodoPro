const pool = require('./backend/shared/db.js').default;

async function testFlow() {
  console.log('--- TEST 1: Check existing users ---');
  const [users] = await pool.query('SELECT id, name, department, role FROM users');
  console.log('Users:', users);

  console.log('\n--- TEST 2: Clear old test notifications ---');
  await pool.query('DELETE FROM process_audit_notifications');
  await pool.query('DELETE FROM process_audit_requests');

  console.log('\n--- TEST 3: Simulate Siva creating a request assigned to ramesh ---');
  const [insertReq] = await pool.query(`
    INSERT INTO process_audit_requests 
    (issue_no, escalation_date, product, model, process_operation, shift, issue_type, priority, issue_observation, department, executor, comments, status, created_by, created_by_id)
    VALUES ('PA-1', CURDATE(), 'Electrical', 'Stator Coil', 'Winding Line 1', 'Shift A', 'Process Deviation', 'High', 'Winding tension out of spec during first hour audit', 'PRODUCTION', 'ramesh', 'Immediate inspection needed', 'Pending Execution', 'siva', 2)
  `);
  const reqId = insertReq.insertId;
  console.log('Created request id:', reqId);

  // Insert notification for executor ramesh
  await pool.query(`
    INSERT INTO process_audit_notifications 
    (user_name, user_id, request_id, issue_no, type, title, message, link, is_read)
    VALUES ('ramesh', 8, ?, 'PA-1', 'approval_required', 'New Audit Request Assigned for Sign-off: #PA-1', 'Request #PA-1 for PRODUCTION (Stator Coil - Winding Line 1) has been assigned to you by siva. Awaiting your review & sign-off.', '/process-audit/approvals', 0)
  `, [reqId]);

  console.log('\n--- TEST 4: Check notifications for ramesh ---');
  const [rameshNotifs] = await pool.query('SELECT * FROM process_audit_notifications WHERE LOWER(TRIM(user_name)) = "ramesh" AND is_read = 0');
  console.log('Unread notifications for ramesh:', rameshNotifs.length, rameshNotifs.map(n => ({ id: n.id, title: n.title, link: n.link })));

  console.log('\n--- TEST 5: Check notifications for ram (should be 0) ---');
  const [ramNotifs] = await pool.query('SELECT * FROM process_audit_notifications WHERE LOWER(TRIM(user_name)) = "ram" AND is_read = 0');
  console.log('Unread notifications for ram:', ramNotifs.length);

  console.log('\n--- TEST 6: Simulate Ramesh Approving the request ---');
  await pool.query('UPDATE process_audit_requests SET status = "Approved" WHERE id = ?', [reqId]);
  await pool.query('UPDATE process_audit_notifications SET is_read = 1 WHERE request_id = ? AND type = "approval_required"', [reqId]);
  
  // Notification for creator siva
  await pool.query(`
    INSERT INTO process_audit_notifications 
    (user_name, user_id, request_id, issue_no, type, title, message, link, is_read)
    VALUES ('siva', 2, ?, 'PA-1', 'request_approved', 'Audit Request #PA-1 Approved', 'Your audit request #PA-1 was approved by ramesh.', '/process-audit/my-requests', 0)
  `, [reqId]);

  const [sivaNotifs] = await pool.query('SELECT * FROM process_audit_notifications WHERE LOWER(TRIM(user_name)) = "siva" AND is_read = 0');
  console.log('Unread notifications for siva after approval:', sivaNotifs.length, sivaNotifs.map(n => ({ id: n.id, title: n.title, link: n.link })));

  const [rameshNotifsAfter] = await pool.query('SELECT * FROM process_audit_notifications WHERE LOWER(TRIM(user_name)) = "ramesh" AND is_read = 0');
  console.log('Unread notifications for ramesh after approval:', rameshNotifsAfter.length);

  process.exit(0);
}

testFlow().catch(e => { console.error(e); process.exit(1); });
