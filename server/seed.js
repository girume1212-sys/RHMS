const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'rhms',
  user: 'postgres',
  password: 'etech',
});

const users = [
  { id: '1', name: 'John Admin', email: 'admin@rhms.com', password: bcrypt.hashSync('admin123', 10), role: 'admin', avatar: null, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: '2', name: 'Sarah Support', email: 'support@rhms.com', password: bcrypt.hashSync('support123', 10), role: 'support', avatar: null, createdAt: '2024-01-15T00:00:00.000Z' },
  { id: '3', name: 'Michael Developer', email: 'dev@rhms.com', password: bcrypt.hashSync('dev123', 10), role: 'developer', avatar: null, createdAt: '2024-02-01T00:00:00.000Z' },
  { id: '4', name: 'Emily Developer', email: 'emily@rhms.com', password: bcrypt.hashSync('dev123', 10), role: 'developer', avatar: null, createdAt: '2024-02-10T00:00:00.000Z' },
  { id: '5', name: 'James Wilson', email: 'james@client.com', password: bcrypt.hashSync('client123', 10), role: 'client', avatar: null, createdAt: '2024-03-01T00:00:00.000Z' },
  { id: '6', name: 'Sarah Johnson', email: 'sarah@client.com', password: bcrypt.hashSync('client123', 10), role: 'client', avatar: null, createdAt: '2024-03-05T00:00:00.000Z' },
  { id: '7', name: 'David Brown', email: 'david@client.com', password: bcrypt.hashSync('client123', 10), role: 'client', avatar: null, createdAt: '2024-03-10T00:00:00.000Z' },
  { id: '8', name: 'Lisa Anderson', email: 'lisa@client.com', password: bcrypt.hashSync('client123', 10), role: 'client', avatar: null, createdAt: '2024-03-15T00:00:00.000Z' },
  { id: '9', name: 'Robert Taylor', email: 'robert@client.com', password: bcrypt.hashSync('client123', 10), role: 'client', avatar: null, createdAt: '2024-04-01T00:00:00.000Z' },
  { id: '10', name: 'Maria Garcia', email: 'maria@client.com', password: bcrypt.hashSync('client123', 10), role: 'client', avatar: null, createdAt: '2024-04-05T00:00:00.000Z' },
];

const categories = [
  { id: '1', name: 'Payroll', description: 'Salary and payment issues', color: '#3B82F6' },
  { id: '2', name: 'Attendance', description: 'Time tracking and attendance', color: '#10B981' },
  { id: '3', name: 'Leave Management', description: 'Leave requests and balances', color: '#F59E0B' },
  { id: '4', name: 'Employee Management', description: 'Employee records and profiles', color: '#8B5CF6' },
  { id: '5', name: 'System', description: 'General system issues', color: '#EF4444' },
  { id: '6', name: 'Reports', description: 'Reporting and analytics', color: '#06B6D4' },
  { id: '7', name: 'Integration', description: 'Third-party integrations', color: '#EC4899' },
  { id: '8', name: 'Other', description: 'Miscellaneous issues', color: '#6B7280' },
];

const priorities = [
  { id: '1', name: 'Low', color: '#3B82F6', level: 1 },
  { id: '2', name: 'Medium', color: '#F59E0B', level: 2 },
  { id: '3', name: 'High', color: '#EF4444', level: 3 },
  { id: '4', name: 'Critical', color: '#DC2626', level: 4 },
];

const statuses = [
  { id: '1', name: 'Open', color: '#3B82F6' },
  { id: '2', name: 'Assigned', color: '#8B5CF6' },
  { id: '3', name: 'In Progress', color: '#F59E0B' },
  { id: '4', name: 'Waiting for Client', color: '#F97316' },
  { id: '5', name: 'Resolved', color: '#10B981' },
  { id: '6', name: 'Closed', color: '#6B7280' },
  { id: '7', name: 'Reopened', color: '#EF4444' },
];

const requests = [
  { id: 'REQ-2024-00128', subject: 'Unable to access payroll module', description: 'I am unable to access the payroll module after the latest update. The page shows a blank screen when I try to navigate to it. I have tried clearing my cache and using a different browser but the issue persists.', clientId: '5', categoryId: '1', priorityId: '3', statusId: '1', assignedTo: null, attachments: '[]', createdAt: '2024-05-18T09:30:00.000Z', updatedAt: '2024-05-18T09:30:00.000Z' },
  { id: 'REQ-2024-00127', subject: 'Error in attendance report', description: 'The attendance report for April 2024 shows incorrect data for several employees. Some employees show as absent when they were actually present. Please investigate this issue as it affects payroll calculations.', clientId: '6', categoryId: '2', priorityId: '2', statusId: '2', assignedTo: '3', attachments: '[]', createdAt: '2024-05-18T08:15:00.000Z', updatedAt: '2024-05-18T10:00:00.000Z' },
  { id: 'REQ-2024-00126', subject: 'Leave balance not updating', description: 'After submitting a leave request that was approved, the leave balance is not being deducted. Multiple employees have reported this issue. This needs urgent attention as it affects leave management.', clientId: '7', categoryId: '3', priorityId: '3', statusId: '3', assignedTo: '4', attachments: '[]', createdAt: '2024-05-17T14:20:00.000Z', updatedAt: '2024-05-18T11:30:00.000Z' },
  { id: 'REQ-2024-00125', subject: 'System dashboard slow', description: 'The main dashboard is loading very slowly, taking over 10 seconds to display data. This is affecting productivity as staff need to wait for the dashboard to load before they can start working.', clientId: '8', categoryId: '5', priorityId: '2', statusId: '3', assignedTo: '3', attachments: '[]', createdAt: '2024-05-17T11:45:00.000Z', updatedAt: '2024-05-17T16:20:00.000Z' },
  { id: 'REQ-2024-00124', subject: "Can't export employee list", description: 'When I try to export the employee list to CSV or PDF, the system shows an error message and the export fails. I need this data for an upcoming audit.', clientId: '9', categoryId: '4', priorityId: '1', statusId: '4', assignedTo: '4', attachments: '[]', createdAt: '2024-05-16T16:00:00.000Z', updatedAt: '2024-05-17T09:00:00.000Z' },
  { id: 'REQ-2024-00123', subject: 'Error while importing data', description: 'I am getting an error when trying to import employee data from an Excel file. The file format matches the template provided but the system keeps rejecting it with a validation error.', clientId: '10', categoryId: '5', priorityId: '4', statusId: '5', assignedTo: '3', attachments: '[]', createdAt: '2024-05-16T10:30:00.000Z', updatedAt: '2024-05-18T14:00:00.000Z' },
  { id: 'REQ-2024-00122', subject: 'Payroll calculation discrepancy', description: 'The payroll calculation for May is showing different amounts compared to our manual calculations. Overtime hours seem to be calculated incorrectly.', clientId: '5', categoryId: '1', priorityId: '3', statusId: '5', assignedTo: '3', attachments: '[]', createdAt: '2024-05-15T13:00:00.000Z', updatedAt: '2024-05-17T17:30:00.000Z' },
  { id: 'REQ-2024-00121', subject: 'Cannot generate tax reports', description: 'The tax report generation feature is not working. When I click generate, nothing happens. I need these reports for the quarterly filing deadline.', clientId: '6', categoryId: '6', priorityId: '2', statusId: '1', assignedTo: null, attachments: '[]', createdAt: '2024-05-15T09:15:00.000Z', updatedAt: '2024-05-15T09:15:00.000Z' },
  { id: 'REQ-2024-00120', subject: 'Integration with accounting software', description: 'We need to integrate the RHMS system with our accounting software (QuickBooks). Please advise on the integration options and timeline.', clientId: '7', categoryId: '7', priorityId: '1', statusId: '2', assignedTo: '4', attachments: '[]', createdAt: '2024-05-14T11:00:00.000Z', updatedAt: '2024-05-15T14:00:00.000Z' },
  { id: 'REQ-2024-00119', subject: 'Employee profile not saving', description: 'When I try to update employee profile information, the changes are not being saved. The form appears to submit but when I go back to the profile, the old data is still showing.', clientId: '8', categoryId: '4', priorityId: '2', statusId: '5', assignedTo: '3', attachments: '[]', createdAt: '2024-05-13T15:30:00.000Z', updatedAt: '2024-05-16T12:00:00.000Z' },
  { id: 'REQ-2024-00118', subject: 'Request for new leave type', description: 'We would like to add a new leave type called "Study Leave" for employees pursuing further education. Please help us set this up in the system.', clientId: '9', categoryId: '3', priorityId: '1', statusId: '6', assignedTo: '4', attachments: '[]', createdAt: '2024-05-12T10:00:00.000Z', updatedAt: '2024-05-14T16:00:00.000Z' },
  { id: 'REQ-2024-00117', subject: 'Dashboard widgets missing', description: 'After the recent update, several dashboard widgets are no longer visible. The attendance summary and leave request widgets are missing.', clientId: '10', categoryId: '5', priorityId: '2', statusId: '6', assignedTo: '3', attachments: '[]', createdAt: '2024-05-11T14:45:00.000Z', updatedAt: '2024-05-13T11:00:00.000Z' },
  { id: 'REQ-2024-00116', subject: 'Duplicate attendance entries', description: 'Some employees are showing duplicate attendance entries for the same day. This is causing issues with overtime calculations.', clientId: '5', categoryId: '2', priorityId: '3', statusId: '5', assignedTo: '4', attachments: '[]', createdAt: '2024-05-10T09:30:00.000Z', updatedAt: '2024-05-12T15:00:00.000Z' },
  { id: 'REQ-2024-00115', subject: 'Salary slip not generated', description: 'Salary slips for April 2024 have not been generated for the sales department. Please check and resolve this issue.', clientId: '6', categoryId: '1', priorityId: '3', statusId: '6', assignedTo: '3', attachments: '[]', createdAt: '2024-05-09T11:00:00.000Z', updatedAt: '2024-05-11T17:00:00.000Z' },
  { id: 'REQ-2024-00114', subject: 'Mobile app login issue', description: 'Several users are unable to login to the mobile app. They get a "Connection timeout" error. Desktop login works fine.', clientId: '7', categoryId: '5', priorityId: '2', statusId: '5', assignedTo: '4', attachments: '[]', createdAt: '2024-05-08T08:00:00.000Z', updatedAt: '2024-05-10T13:30:00.000Z' },
  { id: 'REQ-2024-00113', subject: 'Leave approval workflow', description: 'We need a multi-level approval workflow for leave requests. Currently, only one level of approval is supported.', clientId: '8', categoryId: '3', priorityId: '1', statusId: '6', assignedTo: null, attachments: '[]', createdAt: '2024-05-07T16:15:00.000Z', updatedAt: '2024-05-09T10:00:00.000Z' },
];

const comments = [
  { id: '1', requestId: 'REQ-2024-00127', userId: '3', content: 'I have started investigating the attendance report issue. It appears to be related to the shift scheduling module.', createdAt: '2024-05-18T10:30:00.000Z' },
  { id: '2', requestId: 'REQ-2024-00127', userId: '6', content: 'Thank you for looking into this. Please let me know if you need any additional information from our end.', createdAt: '2024-05-18T11:00:00.000Z' },
  { id: '3', requestId: 'REQ-2024-00126', userId: '4', content: 'I have identified the bug causing the leave balance not to update. The approval callback function was not triggering the balance deduction. Working on the fix now.', createdAt: '2024-05-18T09:00:00.000Z' },
  { id: '4', requestId: 'REQ-2024-00123', userId: '3', content: 'The data import issue has been resolved. The problem was with the date format validation. The system now accepts multiple date formats.', createdAt: '2024-05-18T14:00:00.000Z' },
  { id: '5', requestId: 'REQ-2024-00123', userId: '2', content: 'Marking this as resolved after client confirmation.', createdAt: '2024-05-18T15:00:00.000Z' },
];

const activityLog = [
  { id: '1', type: 'status_update', requestId: 'REQ-2024-00125', userId: '3', message: 'updated to In Progress', createdAt: '2024-05-18T16:20:00.000Z' },
  { id: '2', type: 'comment', requestId: 'REQ-2024-00120', userId: '6', message: 'New comment on request', createdAt: '2024-05-18T15:45:00.000Z' },
  { id: '3', type: 'resolved', requestId: 'REQ-2024-00115', userId: '3', message: 'resolved', createdAt: '2024-05-18T15:00:00.000Z' },
  { id: '4', type: 'created', requestId: 'REQ-2024-00128', userId: '5', message: 'New request created', createdAt: '2024-05-18T14:30:00.000Z' },
  { id: '5', type: 'closed', requestId: 'REQ-2024-00110', userId: '2', message: 'closed', createdAt: '2024-05-18T13:00:00.000Z' },
  { id: '6', type: 'assigned', requestId: 'REQ-2024-00127', userId: '2', message: 'Assigned to Michael Developer', createdAt: '2024-05-18T10:00:00.000Z' },
  { id: '7', type: 'status_update', requestId: 'REQ-2024-00126', userId: '4', message: 'updated to In Progress', createdAt: '2024-05-18T09:00:00.000Z' },
  { id: '8', type: 'created', requestId: 'REQ-2024-00127', userId: '6', message: 'New request created', createdAt: '2024-05-18T08:15:00.000Z' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    for (const u of users) {
      await client.query(
        'INSERT INTO users (id, name, email, password, role, avatar, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [u.id, u.name, u.email, u.password, u.role, u.avatar, u.createdAt]
      );
    }
    console.log(`Inserted ${users.length} users`);

    // Categories
    for (const c of categories) {
      await client.query(
        'INSERT INTO categories (id, name, description, color) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [c.id, c.name, c.description, c.color]
      );
    }
    console.log(`Inserted ${categories.length} categories`);

    // Priorities
    for (const p of priorities) {
      await client.query(
        'INSERT INTO priorities (id, name, color, level) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [p.id, p.name, p.color, p.level]
      );
    }
    console.log(`Inserted ${priorities.length} priorities`);

    // Statuses
    for (const s of statuses) {
      await client.query(
        'INSERT INTO statuses (id, name, color) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [s.id, s.name, s.color]
      );
    }
    console.log(`Inserted ${statuses.length} statuses`);

    // Requests
    for (const r of requests) {
      await client.query(
        'INSERT INTO requests (id, subject, description, client_id, category_id, priority_id, status_id, assigned_to, attachments, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING',
        [r.id, r.subject, r.description, r.clientId, r.categoryId, r.priorityId, r.statusId, r.assignedTo, r.attachments, r.createdAt, r.updatedAt]
      );
    }
    console.log(`Inserted ${requests.length} requests`);

    // Comments
    for (const c of comments) {
      await client.query(
        'INSERT INTO comments (id, request_id, user_id, content, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [c.id, c.requestId, c.userId, c.content, c.createdAt]
      );
    }
    console.log(`Inserted ${comments.length} comments`);

    // Activity Log
    for (const a of activityLog) {
      await client.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [a.id, a.type, a.requestId, a.userId, a.message, a.createdAt]
      );
    }
    console.log(`Inserted ${activityLog.length} activity log entries`);

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
