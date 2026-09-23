const pool = require('./backend/shared/db.js').default;

async function testUpdate() {
  // 1. Insert a pending request for testing
  const [insertRes] = await pool.query(`
    INSERT INTO process_audit_requests 
    (issue_no, escalation_date, product, model, process_operation, shift, issue_type, priority, issue_observation, department, executor, status, created_by, created_by_id)
    VALUES ('PA-TEST-1', CURDATE(), 'Electrical', 'Rotor Core', 'Stamping Line 2', 'Shift B', 'Quality Deviation', 'High', 'Surface scratch observed on rotor core lamination stack', 'PRODUCTION', 'ramesh', 'Pending Execution', 'siva', 2)
  `);
  const id = insertRes.insertId;
  console.log('Inserted test request id:', id);

  // 2. Test status update with the 5 resolution inputs via HTTP
  const payload = {
    status: 'Approved',
    root_cause: 'Worn out guide roller on feeder mechanism causing intermittent friction contact.',
    corrective_action: 'Replaced guide roller with urethane coated roller and adjusted feed alignment clearance.',
    action_attachments: [
      { name: 'roller_replacement_report.pdf', size: '1.2 MB', type: 'PDF', path: 'uploads/attachments/sample.pdf', url: '/api/process-audit/uploads/attachments/sample.pdf' },
      { name: 'repaired_roller_photo.jpg', size: '0.85 MB', type: 'JPG', path: 'uploads/attachments/photo.jpg', url: '/api/process-audit/uploads/attachments/photo.jpg' }
    ],
    standardization_details: 'Updated PM checklist PM-WI-04 to include guide roller inspection every 500 operating hours. Trained shift technicians.',
    target_date: '2026-09-30',
    action_taken_by: 'ramesh'
  };

  const putRes = await fetch(`http://localhost:5002/api/process-audit/requests/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const putData = await putRes.json();
  console.log('PUT status update response success:', putData.success);
  console.log('Updated row root_cause:', putData.data?.root_cause);
  console.log('Updated row corrective_action:', putData.data?.corrective_action);
  console.log('Updated row standardization_details:', putData.data?.standardization_details);
  console.log('Updated row target_date:', putData.data?.target_date);
  console.log('Updated row action_attachments count:', (typeof putData.data?.action_attachments === 'string' ? JSON.parse(putData.data?.action_attachments) : putData.data?.action_attachments)?.length);

  // 3. Clean up test row
  await pool.query('DELETE FROM process_audit_requests WHERE id = ?', [id]);
  console.log('Test completed and cleaned up successfully!');
  process.exit(0);
}

testUpdate().catch(e => { console.error(e); process.exit(1); });
