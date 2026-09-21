import pool from '../../config/db.js';

export const ProcessAuditRequest = {
  findAll: async () => {
    try {
      const [rows] = await pool.query('SELECT * FROM process_audit_requests ORDER BY created_at DESC');
      return rows;
    } catch {
      return [
        { id: 'REQ-1001', date: '03 Sep 2026', shift: 'Morning', production: '1,250 Units', stage: 'Assembly', line: 'Line A - Main Chassis', creator: 'Siva', executor: 'Mr. Kumar', status: 'Pending Execution' },
        { id: 'REQ-1002', date: '03 Sep 2026', shift: 'Evening', production: '980 Units', stage: 'Inspection', line: 'Line C - Optical Inspection', creator: 'Siva', executor: 'Mr. Ravi', status: 'Pending Approval' },
        { id: 'REQ-1003', date: '02 Sep 2026', shift: 'Afternoon', production: '3,400 Units', stage: 'Packaging', line: 'Line D - High Speed Pack', creator: 'Siva', executor: 'Mr. Arjun', status: 'Partially Approved' },
        { id: 'REQ-1004', date: '01 Sep 2026', shift: 'Morning', production: '2,500 Kg', stage: 'Raw Material', line: 'Raw Material Intake Silo 3', creator: 'Siva', executor: 'Mr. Suresh', status: 'Approved' },
        { id: 'REQ-1005', date: '02 Sep 2026', shift: 'Night', production: '2,100 Units', stage: 'Production', line: 'Line B - CNC Milling', creator: 'Siva', executor: 'Mr. Suresh', status: 'Rejected' },
      ];
    }
  },

  create: async (data) => {
    try {
      const query = `
        INSERT INTO process_audit_requests 
        (id, batch_date, shift, priority, quantity, unit, stage, line, creator, executor, status, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await pool.query(query, [
        data.id, data.date, data.shift, data.priority, data.quantity, data.unit, data.stage, data.line, data.creator, data.executor, 'Pending Execution', data.comments
      ]);
      return data;
    } catch {
      return data;
    }
  }
};
