/**
 * CodeAlpha Boards — Notifications Controller
 */

const Notifications = (() => {
  let notifications = [];
  let unreadCount = 0;

  const init = () => {
    setupEventListeners();
  };

  const setupEventListeners = () => {
    const bellBtn = document.getElementById('notificationBellBtn');
    const dropdown = document.getElementById('notificationsDropdown');
    const markAllBtn = document.getElementById('btnMarkAllRead');

    // Toggle dropdown
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      document.getElementById('projectDropdownMenu').classList.add('hidden');
      document.getElementById('userDropdownMenu').classList.add('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    // Mark all as read
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await API.notifications.markAllAsRead();
        unreadCount = 0;
        updateBadge(0);
        notifications.forEach((n) => (n.read = true));
        renderList();
      } catch (err) {
        App.showToast('Error', err.message, 'danger');
      }
    });
  };

  const loadNotifications = async () => {
    try {
      const res = await API.notifications.getAll();
      notifications = res.notifications || [];
      unreadCount = res.unreadCount || 0;
      updateBadge(unreadCount);
      renderList();
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const updateBadge = (count) => {
    const badge = document.getElementById('unreadCountBadge');
    if (!badge) return;

    unreadCount = count;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  };

  const renderList = () => {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (notifications.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">No notifications yet</div>';
      return;
    }

    container.innerHTML = notifications
      .map((item) => {
        const iconInfo = getIconForType(item.type);
        const timeAgo = formatTimeAgo(new Date(item.createdAt));
        const unreadClass = !item.read ? 'unread' : '';

        return `
          <div class="notification-item ${unreadClass}" data-id="${item._id}" data-link="${item.link || ''}">
            <div class="notif-icon ${iconInfo.cssClass}">
              <i class="${iconInfo.icon}"></i>
            </div>
            <div class="notif-content">
              <p class="notif-msg">${escapeHtml(item.message)}</p>
              <span class="notif-time">${timeAgo}</span>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach item click handlers
    container.querySelectorAll('.notification-item').forEach((elem) => {
      elem.addEventListener('click', async () => {
        const id = elem.getAttribute('data-id');
        const link = elem.getAttribute('data-link');

        // Mark as read
        if (elem.classList.contains('unread')) {
          try {
            await API.notifications.markAsRead(id);
            elem.classList.remove('unread');
            unreadCount = Math.max(0, unreadCount - 1);
            updateBadge(unreadCount);
          } catch (err) {
            console.error(err);
          }
        }

        // Handle navigation if link exists
        if (link) {
          handleNotificationLink(link);
        }

        document.getElementById('notificationsDropdown').classList.add('hidden');
      });
    });
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'assignment':
        return { icon: 'fa-solid fa-user-tag', cssClass: 'assignment' };
      case 'comment':
        return { icon: 'fa-regular fa-comment-dots', cssClass: 'comment' };
      case 'move':
        return { icon: 'fa-solid fa-arrows-split-up-and-left', cssClass: 'move' };
      case 'mention':
        return { icon: 'fa-solid fa-at', cssClass: 'mention' };
      case 'member_added':
        return { icon: 'fa-solid fa-user-plus', cssClass: 'member_added' };
      default:
        return { icon: 'fa-solid fa-bell', cssClass: 'assignment' };
    }
  };

  const handleNotificationLink = (link) => {
    // format: ?project=...&task=...
    const urlParams = new URLSearchParams(link);
    const projectId = urlParams.get('project');
    const taskId = urlParams.get('task');

    if (projectId && projectId !== App.getActiveProjectId()) {
      App.switchProject(projectId).then(() => {
        if (taskId) {
          setTimeout(() => Board.openTaskModal(taskId), 300);
        }
      });
    } else if (taskId) {
      Board.openTaskModal(taskId);
    }
  };

  const onSocketNewNotification = (notification) => {
    unreadCount++;
    updateBadge(unreadCount);
    notifications.unshift(notification);
    renderList();

    // Show floating toast alert
    App.showToast(
      'New Notification',
      notification.message,
      'info',
      notification.link ? () => handleNotificationLink(notification.link) : null
    );

    // Pulse animation on bell button
    const bellBtn = document.getElementById('notificationBellBtn');
    if (bellBtn) {
      bellBtn.classList.add('shake-bell');
      setTimeout(() => bellBtn.classList.remove('shake-bell'), 800);
    }
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return {
    init,
    loadNotifications,
    onSocketNewNotification,
  };
})();
