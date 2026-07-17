const pool = require('./db');

(async () => {
  try {
    await pool.query(`
      UPDATE categories SET name = 'Hardware', description = 'Computer, printer, peripherals', color = '#3B82F6' WHERE id = '1'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Software', description = 'Applications, OS, licensing', color = '#10B981' WHERE id = '2'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Network', description = 'WiFi, internet, connectivity', color = '#F59E0B' WHERE id = '3'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Security', description = 'Viruses, malware, access issues', color = '#EF4444' WHERE id = '4'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Email', description = 'Email setup, calendar, Outlook', color = '#8B5CF6' WHERE id = '5'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Account', description = 'Login, password, permissions', color = '#06B6D4' WHERE id = '6'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Data', description = 'Backup, recovery, storage', color = '#EC4899' WHERE id = '7'
    `);
    await pool.query(`
      UPDATE categories SET name = 'Other', description = 'General inquiries, other issues', color = '#6B7280' WHERE id = '8'
    `);
    console.log('Categories updated');

    // Insert missing categories 4-8 if they don't exist
    await pool.query(`
      INSERT INTO categories (id, name, description, color) VALUES
        ('4', 'Security', 'Viruses, malware, access issues', '#EF4444'),
        ('5', 'Email', 'Email setup, calendar, Outlook', '#8B5CF6'),
        ('6', 'Account', 'Login, password, permissions', '#06B6D4'),
        ('7', 'Data', 'Backup, recovery, storage', '#EC4899'),
        ('8', 'Other', 'General inquiries, other issues', '#6B7280')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    `);
    console.log('Missing categories inserted');

    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    console.log('Current categories:');
    result.rows.forEach(r => console.log(`  ${r.id}: ${r.name}`));

    await pool.end();
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
})();
