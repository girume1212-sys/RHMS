const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const users = [
  {
    id: '1',
    name: 'John Admin',
    email: 'admin@rhms.com',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    avatar: null,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: '2',
    name: 'Sarah Support',
    email: 'support@rhms.com',
    password: bcrypt.hashSync('support123', 10),
    role: 'support',
    avatar: null,
    createdAt: '2024-01-15T00:00:00.000Z'
  },
  {
    id: '3',
    name: 'Michael Developer',
    email: 'dev@rhms.com',
    password: bcrypt.hashSync('dev123', 10),
    role: 'developer',
    avatar: null,
    createdAt: '2024-02-01T00:00:00.000Z'
  },
  {
    id: '4',
    name: 'Emily Developer',
    email: 'emily@rhms.com',
    password: bcrypt.hashSync('dev123', 10),
    role: 'developer',
    avatar: null,
    createdAt: '2024-02-10T00:00:00.000Z'
  },
  {
    id: '5',
    name: 'James Wilson',
    email: 'james@client.com',
    password: bcrypt.hashSync('client123', 10),
    role: 'client',
    avatar: null,
    createdAt: '2024-03-01T00:00:00.000Z'
  },
  {
    id: '6',
    name: 'Sarah Johnson',
    email: 'sarah@client.com',
    password: bcrypt.hashSync('client123', 10),
    role: 'client',
    avatar: null,
    createdAt: '2024-03-05T00:00:00.000Z'
  },
  {
    id: '7',
    name: 'David Brown',
    email: 'david@client.com',
    password: bcrypt.hashSync('client123', 10),
    role: 'client',
    avatar: null,
    createdAt: '2024-03-10T00:00:00.000Z'
  },
  {
    id: '8',
    name: 'Lisa Anderson',
    email: 'lisa@client.com',
    password: bcrypt.hashSync('client123', 10),
    role: 'client',
    avatar: null,
    createdAt: '2024-03-15T00:00:00.000Z'
  },
  {
    id: '9',
    name: 'Robert Taylor',
    email: 'robert@client.com',
    password: bcrypt.hashSync('client123', 10),
    role: 'client',
    avatar: null,
    createdAt: '2024-04-01T00:00:00.000Z'
  },
  {
    id: '10',
    name: 'Maria Garcia',
    email: 'maria@client.com',
    password: bcrypt.hashSync('client123', 10),
    role: 'client',
    avatar: null,
    createdAt: '2024-04-05T00:00:00.000Z'
  }
];

const categories = [
  { id: '1', name: 'Hardware', description: 'Computer, printer, peripherals', color: '#3B82F6' },
  { id: '2', name: 'Software', description: 'Applications, OS, licensing', color: '#10B981' },
  { id: '3', name: 'Network', description: 'WiFi, internet, connectivity', color: '#F59E0B' },
  { id: '4', name: 'Security', description: 'Viruses, malware, access issues', color: '#EF4444' },
  { id: '5', name: 'Email', description: 'Email setup, calendar, Outlook', color: '#8B5CF6' },
  { id: '6', name: 'Account', description: 'Login, password, permissions', color: '#06B6D4' },
  { id: '7', name: 'Data', description: 'Backup, recovery, storage', color: '#EC4899' },
  { id: '8', name: 'Other', description: 'General inquiries, other issues', color: '#6B7280' }
];

const priorities = [
  { id: '1', name: 'Low', color: '#3B82F6', level: 1 },
  { id: '2', name: 'Medium', color: '#F59E0B', level: 2 },
  { id: '3', name: 'High', color: '#EF4444', level: 3 },
  { id: '4', name: 'Critical', color: '#DC2626', level: 4 }
];

const statuses = [
  { id: '1', name: 'Open', color: '#3B82F6' },
  { id: '2', name: 'Assigned', color: '#8B5CF6' },
  { id: '3', name: 'In Progress', color: '#F59E0B' },
  { id: '4', name: 'Waiting for Client', color: '#F97316' },
  { id: '5', name: 'Resolved', color: '#10B981' },
  { id: '6', name: 'Closed', color: '#6B7280' },
  { id: '7', name: 'Reopened', color: '#EF4444' }
];

const requests = [
  {
    id: 'REQ-2024-00128',
    subject: 'Printer not working in office',
    description: 'The HP LaserJet printer on the 3rd floor is not printing. It shows an error message "Paper Jam" but there is no paper stuck.',
    clientId: '5',
    categoryId: '1',
    priorityId: '3',
    statusId: '1',
    assignedTo: null,
    attachments: [],
    createdAt: '2024-05-18T09:30:00.000Z',
    updatedAt: '2024-05-18T09:30:00.000Z'
  },
  {
    id: 'REQ-2024-00127',
    subject: 'Software update failing',
    description: 'Windows update keeps failing with error code 0x80070002. I have tried multiple times but the update does not complete.',
    clientId: '6',
    categoryId: '2',
    priorityId: '2',
    statusId: '2',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-18T08:15:00.000Z',
    updatedAt: '2024-05-18T10:00:00.000Z'
  },
  {
    id: 'REQ-2024-00126',
    subject: 'WiFi connection dropping frequently',
    description: 'The office WiFi keeps disconnecting every few minutes. This is affecting all employees in the marketing department.',
    clientId: '7',
    categoryId: '3',
    priorityId: '3',
    statusId: '3',
    assignedTo: '4',
    attachments: [],
    createdAt: '2024-05-17T14:20:00.000Z',
    updatedAt: '2024-05-18T11:30:00.000Z'
  },
  {
    id: 'REQ-2024-00125',
    subject: 'Suspicious email received',
    description: 'I received a suspicious email asking for login credentials. It appears to be a phishing attempt. Please investigate.',
    clientId: '8',
    categoryId: '4',
    priorityId: '4',
    statusId: '3',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-17T11:45:00.000Z',
    updatedAt: '2024-05-17T16:20:00.000Z'
  },
  {
    id: 'REQ-2024-00124',
    subject: 'Outlook not syncing',
    description: 'My Outlook email is not syncing with the server. I cannot send or receive emails since this morning.',
    clientId: '9',
    categoryId: '5',
    priorityId: '3',
    statusId: '4',
    assignedTo: '4',
    attachments: [],
    createdAt: '2024-05-16T16:00:00.000Z',
    updatedAt: '2024-05-17T09:00:00.000Z'
  },
  {
    id: 'REQ-2024-00123',
    subject: 'Cannot login to VPN',
    description: 'I am unable to connect to the VPN from home. The connection times out after 30 seconds.',
    clientId: '10',
    categoryId: '6',
    priorityId: '3',
    statusId: '5',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-16T10:30:00.000Z',
    updatedAt: '2024-05-18T14:00:00.000Z'
  },
  {
    id: 'REQ-2024-00122',
    subject: 'Need data backup for project files',
    description: 'Please backup the project files from the shared drive. I need to format my computer and want to ensure no data is lost.',
    clientId: '5',
    categoryId: '7',
    priorityId: '2',
    statusId: '5',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-15T13:00:00.000Z',
    updatedAt: '2024-05-17T17:30:00.000Z'
  },
  {
    id: 'REQ-2024-00121',
    subject: 'Request for new monitor',
    description: 'I need a second monitor for my workstation to improve productivity. Currently using a single 24-inch screen.',
    clientId: '6',
    categoryId: '1',
    priorityId: '1',
    statusId: '1',
    assignedTo: null,
    attachments: [],
    createdAt: '2024-05-15T09:15:00.000Z',
    updatedAt: '2024-05-15T09:15:00.000Z'
  },
  {
    id: 'REQ-2024-00120',
    subject: 'Install Adobe Creative Suite',
    description: 'I need Adobe Creative Suite installed on my workstation for the upcoming design project. Please install Photoshop, Illustrator, and InDesign.',
    clientId: '7',
    categoryId: '2',
    priorityId: '2',
    statusId: '2',
    assignedTo: '4',
    attachments: [],
    createdAt: '2024-05-14T11:00:00.000Z',
    updatedAt: '2024-05-15T14:00:00.000Z'
  },
  {
    id: 'REQ-2024-00119',
    subject: 'Internet speed is slow',
    description: 'The internet speed in the east wing is very slow. Download speed is less than 1 Mbps. This is affecting video calls.',
    clientId: '8',
    categoryId: '3',
    priorityId: '3',
    statusId: '5',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-13T15:30:00.000Z',
    updatedAt: '2024-05-16T12:00:00.000Z'
  },
  {
    id: 'REQ-2024-00118',
    subject: 'Password reset needed',
    description: 'I forgot my domain password and need it reset. I have an important meeting in 2 hours.',
    clientId: '9',
    categoryId: '6',
    priorityId: '3',
    statusId: '6',
    assignedTo: '4',
    attachments: [],
    createdAt: '2024-05-12T10:00:00.000Z',
    updatedAt: '2024-05-14T16:00:00.000Z'
  },
  {
    id: 'REQ-2024-00117',
    subject: 'Antivirus alert on workstation',
    description: 'My computer is showing antivirus alerts about detected malware. I have not clicked on any suspicious links.',
    clientId: '10',
    categoryId: '4',
    priorityId: '4',
    statusId: '6',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-11T14:45:00.000Z',
    updatedAt: '2024-05-13T11:00:00.000Z'
  },
  {
    id: 'REQ-2024-00116',
    subject: 'Laptop battery draining fast',
    description: 'My laptop battery only lasts 1 hour on full charge. It used to last 4 hours before. Need battery replacement.',
    clientId: '5',
    categoryId: '1',
    priorityId: '2',
    statusId: '5',
    assignedTo: '4',
    attachments: [],
    createdAt: '2024-05-10T09:30:00.000Z',
    updatedAt: '2024-05-12T15:00:00.000Z'
  },
  {
    id: 'REQ-2024-00115',
    subject: 'Shared drive access denied',
    description: 'I cannot access the shared drive "Marketing" folder. It shows "Access Denied" error.',
    clientId: '6',
    categoryId: '8',
    priorityId: '2',
    statusId: '6',
    assignedTo: '3',
    attachments: [],
    createdAt: '2024-05-09T11:00:00.000Z',
    updatedAt: '2024-05-11T17:00:00.000Z'
  },
  {
    id: 'REQ-2024-00114',
    subject: 'Zoom meeting audio issues',
    description: 'My audio keeps cutting out during Zoom meetings. Other participants cannot hear me clearly.',
    clientId: '7',
    categoryId: '8',
    priorityId: '2',
    statusId: '5',
    assignedTo: '4',
    attachments: [],
    createdAt: '2024-05-08T08:00:00.000Z',
    updatedAt: '2024-05-10T13:30:00.000Z'
  },
  {
    id: 'REQ-2024-00113',
    subject: 'New employee laptop setup',
    description: 'We have a new employee joining next Monday. Please set up a laptop with standard software and email configuration.',
    clientId: '8',
    categoryId: '8',
    priorityId: '2',
    statusId: '6',
    assignedTo: null,
    attachments: [],
    createdAt: '2024-05-07T16:15:00.000Z',
    updatedAt: '2024-05-09T10:00:00.000Z'
  }
];

const comments = [
  {
    id: '1',
    requestId: 'REQ-2024-00127',
    userId: '3',
    content: 'I have checked the Windows update logs. The issue seems to be with a corrupted system file. Running SFC scan now.',
    createdAt: '2024-05-18T10:30:00.000Z'
  },
  {
    id: '2',
    requestId: 'REQ-2024-00127',
    userId: '6',
    content: 'Thank you for looking into this. Please let me know if you need any additional information from our end.',
    createdAt: '2024-05-18T11:00:00.000Z'
  },
  {
    id: '3',
    requestId: 'REQ-2024-00126',
    userId: '4',
    content: 'I have identified the issue with the WiFi router. It needs a firmware update. Will update it during lunch break.',
    createdAt: '2024-05-18T09:00:00.000Z'
  },
  {
    id: '4',
    requestId: 'REQ-2024-00123',
    userId: '3',
    content: 'The VPN issue has been resolved. The problem was with the VPN server configuration. Please try connecting again.',
    createdAt: '2024-05-18T14:00:00.000Z'
  },
  {
    id: '5',
    requestId: 'REQ-2024-00123',
    userId: '2',
    content: 'Marking this as resolved after client confirmation.',
    createdAt: '2024-05-18T15:00:00.000Z'
  }
];

const activityLog = [
  { id: '1', type: 'status_update', requestId: 'REQ-2024-00125', userId: '3', message: 'updated to In Progress', createdAt: '2024-05-18T16:20:00.000Z' },
  { id: '2', type: 'comment', requestId: 'REQ-2024-00120', userId: '6', message: 'New comment on request', createdAt: '2024-05-18T15:45:00.000Z' },
  { id: '3', type: 'resolved', requestId: 'REQ-2024-00115', userId: '3', message: 'resolved', createdAt: '2024-05-18T15:00:00.000Z' },
  { id: '4', type: 'created', requestId: 'REQ-2024-00128', userId: '5', message: 'New request created', createdAt: '2024-05-18T14:30:00.000Z' },
  { id: '5', type: 'closed', requestId: 'REQ-2024-00110', userId: '2', message: 'closed', createdAt: '2024-05-18T13:00:00.000Z' },
  { id: '6', type: 'assigned', requestId: 'REQ-2024-00127', userId: '2', message: 'Assigned to Michael Developer', createdAt: '2024-05-18T10:00:00.000Z' },
  { id: '7', type: 'status_update', requestId: 'REQ-2024-00126', userId: '4', message: 'updated to In Progress', createdAt: '2024-05-18T09:00:00.000Z' },
  { id: '8', type: 'created', requestId: 'REQ-2024-00127', userId: '6', message: 'New request created', createdAt: '2024-05-18T08:15:00.000Z' }
];

module.exports = { users, categories, priorities, statuses, requests, comments, activityLog };
