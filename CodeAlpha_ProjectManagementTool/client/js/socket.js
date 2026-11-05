/**
 * CodeAlpha Boards — Real-time Socket.io Client
 */

const AppSocket = (() => {
  let socket = null;
  let currentProjectId = null;

  const init = (token) => {
    if (socket) {
      socket.disconnect();
    }

    if (!token) return;

    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const statusPill = document.getElementById('connectionStatusPill');

    socket.on('connect', () => {
      console.log('[Socket] Connected to real-time server with id:', socket.id);
      if (statusPill) {
        statusPill.className = 'status-pill connected';
        statusPill.innerHTML = '<span class="status-pulse"></span><span class="status-text">Live Sync</span>';
      }

      // Re-join active project room if we already had one selected
      if (currentProjectId) {
        joinProject(currentProjectId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      if (statusPill) {
        statusPill.className = 'status-pill';
        statusPill.style.background = 'rgba(244, 63, 94, 0.1)';
        statusPill.style.color = '#f43f5e';
        statusPill.style.borderColor = 'rgba(244, 63, 94, 0.25)';
        statusPill.innerHTML = '<span class="status-text">Connecting...</span>';
      }
    });

    // Project real-time event listeners
    socket.on('project:task_created', (task) => {
      console.log('[Socket Event] task_created:', task);
      Board.onSocketTaskCreated(task);
    });

    socket.on('project:task_updated', (task) => {
      console.log('[Socket Event] task_updated:', task);
      Board.onSocketTaskUpdated(task);
    });

    socket.on('project:task_moved', (data) => {
      console.log('[Socket Event] task_moved:', data);
      Board.onSocketTaskMoved(data);
    });

    socket.on('project:task_deleted', (data) => {
      console.log('[Socket Event] task_deleted:', data);
      Board.onSocketTaskDeleted(data);
    });

    socket.on('project:columns_updated', (columns) => {
      console.log('[Socket Event] columns_updated:', columns);
      Board.onSocketColumnsUpdated(columns);
    });

    socket.on('project:tasks_reloaded', (tasks) => {
      console.log('[Socket Event] tasks_reloaded:', tasks);
      Board.onSocketTasksReloaded(tasks);
    });

    socket.on('project:members_updated', (members) => {
      console.log('[Socket Event] members_updated:', members);
      App.onSocketMembersUpdated(members);
    });

    socket.on('project:comment_added', (data) => {
      console.log('[Socket Event] comment_added:', data);
      Board.onSocketCommentAdded(data);
    });

    socket.on('project:comment_deleted', (data) => {
      console.log('[Socket Event] comment_deleted:', data);
      Board.onSocketCommentDeleted(data);
    });

    // In-app direct notification listener
    socket.on('notification:new', (notification) => {
      console.log('[Socket Event] notification:new:', notification);
      Notifications.onSocketNewNotification(notification);
    });

    socket.on('user_typing_comment', (data) => {
      Board.onSocketUserTyping(data);
    });
  };

  const joinProject = (projectId) => {
    if (!socket || !projectId) return;

    if (currentProjectId && currentProjectId !== projectId) {
      socket.emit('leave_project', currentProjectId);
    }

    currentProjectId = projectId;
    socket.emit('join_project', projectId);
    console.log('[Socket] Joined project room:', projectId);
  };

  const leaveCurrentProject = () => {
    if (socket && currentProjectId) {
      socket.emit('leave_project', currentProjectId);
      currentProjectId = null;
    }
  };

  const emitTyping = (projectId, taskId, isTyping) => {
    if (socket && projectId) {
      socket.emit('typing_comment', { projectId, taskId, isTyping });
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      currentProjectId = null;
    }
  };

  return {
    init,
    joinProject,
    leaveCurrentProject,
    emitTyping,
    disconnect,
  };
})();
