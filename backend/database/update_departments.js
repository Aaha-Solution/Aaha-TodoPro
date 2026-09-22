import pool from '../shared/db.js';

async function updateDepartments() {
  try {
    console.log('Connecting to DB to check and update departments...');
    const [users] = await pool.query('SELECT id, name, email, department FROM users');
    console.log('Current users in DB:', users);

    // Map any old/unlisted department to one of the 6 allowed
    // Allowed: MAINTENANCE, PRODUCTION, PED, MATERIALS, MARKETING, INCOMING QUALITY
    for (const u of users) {
      let dept = u.department ? u.department.toUpperCase() : 'PRODUCTION';
      if (dept.includes('QUALITY') || dept.includes('QA')) {
        dept = 'INCOMING QUALITY';
      } else if (dept.includes('MAINT')) {
        dept = 'MAINTENANCE';
      } else if (dept.includes('PROD') || dept.includes('PLAN')) {
        dept = 'PRODUCTION';
      } else if (dept.includes('MAT')) {
        dept = 'MATERIALS';
      } else if (dept.includes('MARKET')) {
        dept = 'MARKETING';
      } else if (dept.includes('PED') || dept.includes('ENG')) {
        dept = 'PED';
      } else {
        dept = 'PRODUCTION';
      }

      await pool.query('UPDATE users SET department = ? WHERE id = ?', [dept, u.id]);
    }

    const [updatedUsers] = await pool.query('SELECT id, name, email, department FROM users');
    console.log('Updated users with allowed departments:', updatedUsers);
    process.exit(0);
  } catch (err) {
    console.error('Error updating departments:', err);
    process.exit(1);
  }
}

updateDepartments();
