require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Comment = require('./models/Comment');
const Notification = require('./models/Notification');

const seedData = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      console.log('[Seed] Connecting to database...');
      await connectDB();
    }

    console.log('[Seed] Clearing existing collections...');
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});

    console.log('[Seed] Creating demo users...');
    // Demo users
    const alex = await User.create({
      name: 'Alex Rivera',
      email: 'alex@example.com',
      password: 'password123',
      avatarColor: '#6366f1', // Indigo
    });

    const sarah = await User.create({
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      password: 'password123',
      avatarColor: '#ec4899', // Pink
    });

    const john = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      avatarColor: '#10b981', // Emerald
    });

    console.log(`[Seed] Created 3 users: Alex (${alex._id}), Sarah (${sarah._id}), John (${john._id})`);

    // Create Main Project
    console.log('[Seed] Creating project...');
    const project = await Project.create({
      name: 'CodeAlpha Web Platform 2.0',
      description: 'Collaborative development workspace for the next-generation CodeAlpha web application.',
      owner: alex._id,
      members: [
        { user: alex._id, role: 'owner', joinedAt: new Date(Date.now() - 7 * 86400000) },
        { user: sarah._id, role: 'member', joinedAt: new Date(Date.now() - 6 * 86400000) },
        { user: john._id, role: 'member', joinedAt: new Date(Date.now() - 5 * 86400000) },
      ],
      columns: [
        { id: 'todo', name: 'To Do', order: 0 },
        { id: 'in_progress', name: 'In Progress', order: 1 },
        { id: 'review', name: 'Review', order: 2 },
        { id: 'done', name: 'Done', order: 3 },
      ],
    });

    // Create secondary project for multi-project demonstration
    const mobileProject = await Project.create({
      name: 'Mobile App Redesign',
      description: 'Native mobile companion app for iOS and Android with offline board syncing.',
      owner: sarah._id,
      members: [
        { user: sarah._id, role: 'owner', joinedAt: new Date(Date.now() - 3 * 86400000) },
        { user: alex._id, role: 'member', joinedAt: new Date(Date.now() - 2 * 86400000) },
      ],
      columns: [
        { id: 'todo', name: 'To Do', order: 0 },
        { id: 'in_progress', name: 'In Progress', order: 1 },
        { id: 'done', name: 'Done', order: 2 },
      ],
    });

    console.log('[Seed] Creating sample tasks for CodeAlpha Web Platform 2.0...');
    const today = new Date();
    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);
    const inFiveDays = new Date(today);
    inFiveDays.setDate(today.getDate() + 5);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const task1 = await Task.create({
      project: project._id,
      title: 'Design Responsive Kanban Board UI',
      description: 'Create modern UI with glassmorphism styling, clean column headers, priority indicators, and responsive layout for mobile & desktop.',
      status: 'done',
      priority: 'high',
      dueDate: yesterday,
      assignee: sarah._id,
      labels: ['ui/ux', 'frontend', 'design'],
      order: 0,
      createdBy: alex._id,
    });

    const task2 = await Task.create({
      project: project._id,
      title: 'Set up Node.js & Socket.io Architecture',
      description: 'Configure Express REST API, JWT authentication, centralized error handling, and Socket.io room management per project.',
      status: 'done',
      priority: 'urgent',
      dueDate: yesterday,
      assignee: alex._id,
      labels: ['backend', 'architecture', 'websockets'],
      order: 1,
      createdBy: alex._id,
    });

    const task3 = await Task.create({
      project: project._id,
      title: 'Implement Real-time Drag-and-Drop Task Moving',
      description: 'Connect HTML5 Drag & Drop events to the backend /api/tasks/:id/move endpoint and broadcast updates via Socket.io across all active client sessions.',
      status: 'in_progress',
      priority: 'urgent',
      dueDate: inTwoDays,
      assignee: sarah._id,
      labels: ['frontend', 'feature', 'realtime'],
      order: 0,
      createdBy: alex._id,
    });

    const task4 = await Task.create({
      project: project._id,
      title: 'Task Comments & Mention Notifications',
      description: 'Build comment thread inside the task modal with instant updates, user avatars, and automatic notifications for mentioned members.',
      status: 'in_progress',
      priority: 'high',
      dueDate: inTwoDays,
      assignee: alex._id,
      labels: ['backend', 'notifications', 'feature'],
      order: 1,
      createdBy: alex._id,
    });

    const task5 = await Task.create({
      project: project._id,
      title: 'Live Search and Priority Filters',
      description: 'Allow instant filtering by title search, status, priority (Urgent/High/Medium/Low), and assignee with zero page reloads.',
      status: 'review',
      priority: 'medium',
      dueDate: inFiveDays,
      assignee: sarah._id,
      labels: ['frontend', 'search'],
      order: 0,
      createdBy: alex._id,
    });

    const task6 = await Task.create({
      project: project._id,
      title: 'Write Automated Integration Tests & CI Pipeline',
      description: 'Add tests covering auth routes, project permissions, board task moves, and comment notification dispatch.',
      status: 'todo',
      priority: 'medium',
      dueDate: inFiveDays,
      assignee: john._id,
      labels: ['qa', 'testing', 'devops'],
      order: 0,
      createdBy: alex._id,
    });

    const task7 = await Task.create({
      project: project._id,
      title: 'Security Audit: Helmet, CORS & Rate Limits',
      description: 'Review API endpoints against OWASP recommendations, verify rate limiting on authentication routes, and check JWT signing security.',
      status: 'todo',
      priority: 'low',
      dueDate: inFiveDays,
      assignee: john._id,
      labels: ['security', 'audit'],
      order: 1,
      createdBy: alex._id,
    });

    // Sample task for mobile app project
    await Task.create({
      project: mobileProject._id,
      title: 'Define Design Tokens for Dark Theme',
      description: 'Export color palette, elevation shadows, and typography tokens matching the web dashboard.',
      status: 'in_progress',
      priority: 'medium',
      dueDate: inTwoDays,
      assignee: alex._id,
      labels: ['mobile', 'design'],
      order: 0,
      createdBy: sarah._id,
    });

    console.log('[Seed] Adding sample comments...');
    await Comment.create({
      task: task3._id,
      project: project._id,
      author: alex._id,
      text: 'Hey @Sarah Chen, let us make sure the drop target has a highlighted border preview when hovering over columns!',
      createdAt: new Date(Date.now() - 3600000 * 4),
    });

    await Comment.create({
      task: task3._id,
      project: project._id,
      author: sarah._id,
      text: 'Done! Added smooth CSS transitions and a glowing dashed indicator when dragging over any column.',
      createdAt: new Date(Date.now() - 3600000 * 2),
    });

    await Comment.create({
      task: task4._id,
      project: project._id,
      author: john._id,
      text: 'Verified that mentions trigger both an in-app notification and an unread badge increment in real time.',
      createdAt: new Date(Date.now() - 3600000 * 1),
    });

    console.log('[Seed] Adding sample notifications...');
    await Notification.create({
      user: sarah._id,
      sender: alex._id,
      project: project._id,
      task: task3._id,
      type: 'assignment',
      message: 'Alex Rivera assigned you to task: "Implement Real-time Drag-and-Drop Task Moving"',
      link: `?project=${project._id}&task=${task3._id}`,
      read: false,
    });

    await Notification.create({
      user: sarah._id,
      sender: alex._id,
      project: project._id,
      task: task3._id,
      type: 'mention',
      message: 'Alex Rivera mentioned you in a comment on "Implement Real-time Drag-and-Drop Task Moving"',
      link: `?project=${project._id}&task=${task3._id}`,
      read: false,
    });

    await Notification.create({
      user: alex._id,
      sender: sarah._id,
      project: project._id,
      task: task3._id,
      type: 'comment',
      message: 'Sarah Chen commented on your task: "Implement Real-time Drag-and-Drop Task Moving"',
      link: `?project=${project._id}&task=${task3._id}`,
      read: true,
    });

    await Notification.create({
      user: john._id,
      sender: alex._id,
      project: project._id,
      task: task6._id,
      type: 'assignment',
      message: 'Alex Rivera assigned you to task: "Write Automated Integration Tests & CI Pipeline"',
      link: `?project=${project._id}&task=${task6._id}`,
      read: false,
    });

    console.log('========================================================');
    console.log('🎉 Seed completed successfully!');
    console.log('--------------------------------------------------------');
    console.log('Demo Credentials:');
    console.log('  1. Alex Rivera (Lead / Owner): alex@example.com / password123');
    console.log('  2. Sarah Chen  (Frontend Dev):  sarah@example.com / password123');
    console.log('  3. John Doe    (Backend Dev):   john@example.com  / password123');
    console.log('========================================================');

    if (require.main === module) {
      await disconnectDB();
      process.exit(0);
    }
    return true;
  } catch (err) {
    console.error('[Seed Error]:', err);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
};

if (require.main === module) {
  seedData();
}

module.exports = { seedData };

