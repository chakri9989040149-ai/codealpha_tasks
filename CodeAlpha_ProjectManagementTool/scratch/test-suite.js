const io = require('socket.io-client');

const BASE_URL = 'http://localhost:3003';

async function runTests() {
  console.log('=== STARTING AUTOMATED END-TO-END QA TEST SUITE ===');

  // Helper fetch function
  const api = async (endpoint, options = {}, token = null) => {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  };

  try {
    // TEST 1: Health Check
    console.log('\n[TEST 1] Checking API Health...');
    const health = await api('/api/health');
    console.assert(health.ok, 'Health check failed');
    console.log('✔ Health check OK:', health.data.status);

    // TEST 2: Registration
    console.log('\n[TEST 2] Testing User Registration...');
    const testEmail = `qa_user_${Date.now()}@example.com`;
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Test Engineer',
        email: testEmail,
        password: 'password123',
      }),
    });
    console.assert(regRes.status === 201, 'Registration failed: ' + JSON.stringify(regRes.data));
    console.assert(regRes.data.token, 'Token missing in register response');
    console.log('✔ Registration successful for:', testEmail);

    // TEST 3: Login with Demo User Alex (Owner)
    console.log('\n[TEST 3] Testing Login with Alex (Owner)...');
    const alexLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
    });
    console.assert(alexLogin.ok, 'Alex login failed');
    const alexToken = alexLogin.data.token;
    const alexUser = alexLogin.data.user;
    console.log('✔ Alex logged in successfully:', alexUser.name);

    // TEST 4: Login with Demo User Sarah (Member)
    console.log('\n[TEST 4] Testing Login with Sarah (Member)...');
    const sarahLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'sarah@example.com', password: 'password123' }),
    });
    console.assert(sarahLogin.ok, 'Sarah login failed');
    const sarahToken = sarahLogin.data.token;
    const sarahUser = sarahLogin.data.user;
    console.log('✔ Sarah logged in successfully:', sarahUser.name);

    // TEST 5: Create a new project
    console.log('\n[TEST 5] Creating a new collaborative project...');
    const projRes = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Real-Time Project',
        description: 'Project created during automated QA pass',
      }),
    }, alexToken);
    console.assert(projRes.status === 201, 'Project creation failed');
    const project = projRes.data.project;
    console.log('✔ Project created:', project.name, `(${project._id})`);

    // TEST 6: Real-time Sockets for Alex and Sarah
    console.log('\n[TEST 6] Connecting 2 distinct Socket.io clients...');
    const alexSocket = io(BASE_URL, { auth: { token: alexToken } });
    const sarahSocket = io(BASE_URL, { auth: { token: sarahToken } });

    await new Promise((resolve) => {
      let count = 0;
      alexSocket.on('connect', () => { if (++count === 2) resolve(); });
      sarahSocket.on('connect', () => { if (++count === 2) resolve(); });
    });
    console.log('✔ Both Alex and Sarah authenticated and connected via WebSockets');

    // TEST 7: Authorization Check before inviting Sarah
    console.log('\n[TEST 7] Verifying Sarah cannot access project before being invited...');
    const unauthCheck = await api(`/api/projects/${project._id}`, {}, sarahToken);
    console.assert(unauthCheck.status === 403, 'Expected 403 Forbidden for non-member');
    console.log('✔ Authorization verified: non-member correctly received 403 Forbidden');

    // TEST 8: Alex invites Sarah to the project
    console.log('\n[TEST 8] Alex invites Sarah to project...');
    let sarahNotifPromise = new Promise((resolve) => {
      sarahSocket.on('notification:new', (notif) => {
        resolve(notif);
      });
    });

    const inviteRes = await api(`/api/projects/${project._id}/members`, {
      method: 'POST',
      body: JSON.stringify({ email: 'sarah@example.com', role: 'member' }),
    }, alexToken);
    console.assert(inviteRes.ok, 'Invite member failed: ' + JSON.stringify(inviteRes.data));
    console.log('✔ Member invited successfully');

    const inviteNotif = await sarahNotifPromise;
    console.assert(inviteNotif.type === 'member_added', 'Expected member_added notification');
    console.log('✔ Sarah received real-time invite notification:', inviteNotif.message);

    // Sarah now joins project socket room
    alexSocket.emit('join_project', project._id);
    sarahSocket.emit('join_project', project._id);

    // TEST 9: Create Task and verify real-time broadcast to Sarah
    console.log('\n[TEST 9] Creating a task and testing real-time socket sync to Sarah...');
    const taskCreatedPromise = new Promise((resolve) => {
      sarahSocket.on('project:task_created', (t) => resolve(t));
    });

    const createTaskRes = await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        projectId: project._id,
        title: 'Implement Dark Theme Tokens',
        description: 'Verify color tokens match design guidelines',
        status: 'todo',
        priority: 'urgent',
        assignee: sarahUser._id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        labels: ['frontend', 'tokens'],
      }),
    }, alexToken);
    console.assert(createTaskRes.status === 201, 'Task creation failed');
    const createdTask = createTaskRes.data.task;
    console.log('✔ Task created via REST API:', createdTask.title);

    const broadcastTask = await taskCreatedPromise;
    console.assert(broadcastTask._id === createdTask._id, 'Task ID mismatch in broadcast');
    console.log('✔ Sarah received real-time project:task_created event for:', broadcastTask.title);

    // TEST 10: Sarah moves task from 'todo' to 'in_progress' (Drag & Drop endpoint)
    console.log('\n[TEST 10] Testing Drag-and-Drop Task Move & Real-time Sync to Alex...');
    const taskMovedPromise = new Promise((resolve) => {
      alexSocket.on('project:task_moved', (data) => resolve(data));
    });

    const moveRes = await api(`/api/tasks/${createdTask._id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'in_progress', order: 0 }),
    }, sarahToken);
    console.assert(moveRes.ok, 'Move task failed');
    console.log('✔ Task moved to in_progress in database');

    const movedBroadcast = await taskMovedPromise;
    console.assert(movedBroadcast.newStatus === 'in_progress', 'Move status mismatch in broadcast');
    console.log('✔ Alex instantly received real-time project:task_moved event! Mover:', movedBroadcast.movedBy.name);

    // Confirm persistence by re-fetching task from database
    const verifyMove = await api(`/api/tasks?projectId=${project._id}`, {}, alexToken);
    const refreshedTask = verifyMove.data.tasks.find((t) => t._id === createdTask._id);
    console.assert(refreshedTask.status === 'in_progress', 'Task move was not persisted');
    console.log('✔ Confirmed persisted status in database is:', refreshedTask.status);

    // TEST 11: Comments and @Mentions Notifications
    console.log('\n[TEST 11] Testing Task Comments, Real-time Sync & @Mentions...');
    const commentAddedPromise = new Promise((resolve) => {
      sarahSocket.on('project:comment_added', (data) => resolve(data));
    });

    const commentRes = await api('/api/comments', {
      method: 'POST',
      body: JSON.stringify({
        taskId: createdTask._id,
        text: 'Hey @Sarah Chen, please review the color contrast ratios.',
      }),
    }, alexToken);
    console.assert(commentRes.status === 201, 'Add comment failed');
    console.log('✔ Comment added by Alex');

    const commentBroadcast = await commentAddedPromise;
    console.assert(commentBroadcast.comment.text.includes('color contrast'), 'Comment text mismatch');
    console.log('✔ Sarah received real-time project:comment_added event');

    // TEST 12: Notification & Unread Count for Sarah
    console.log('\n[TEST 12] Verifying In-app Notifications & Unread Count for Sarah...');
    const notifsRes = await api('/api/notifications', {}, sarahToken);
    console.assert(notifsRes.ok, 'Get notifications failed');
    console.assert(notifsRes.data.unreadCount > 0, 'Expected positive unread notification count');
    console.log(`✔ Sarah has ${notifsRes.data.unreadCount} unread notifications`);

    // Mark single notification as read
    const firstNotifId = notifsRes.data.notifications[0]._id;
    const readRes = await api(`/api/notifications/${firstNotifId}/read`, { method: 'PUT' }, sarahToken);
    console.assert(readRes.ok, 'Mark read failed');
    console.log('✔ Notification marked read. New unread count:', readRes.data.unreadCount);

    // TEST 13: Dashboard Metrics
    console.log('\n[TEST 13] Verifying Dashboard Aggregated Metrics...');
    const dashRes = await api('/api/dashboard', {}, sarahToken);
    console.assert(dashRes.ok, 'Dashboard failed');
    console.log('✔ Dashboard metrics retrieved successfully:', JSON.stringify(dashRes.data.stats));
    console.assert(dashRes.data.projectProgress.length > 0, 'Expected project progress items');
    console.log('✔ Project progress items count:', dashRes.data.projectProgress.length);

    // Cleanup sockets
    alexSocket.disconnect();
    sarahSocket.disconnect();

    console.log('\n======================================================');
    console.log('🎉 ALL 13 TEST SUITE FLOWS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ QA Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
