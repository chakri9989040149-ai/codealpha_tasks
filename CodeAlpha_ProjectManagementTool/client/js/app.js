/**
 * CodeAlpha Boards — Main Application Controller
 */

const App = (() => {
  let activeProjectId = null;
  let activeProject = null;
  let projectsList = [];
  let currentView = 'kanban';

  const init = async () => {
    // Initialize child modules
    Auth.init();
    Board.init();
    Dashboard.init();
    Notifications.init();

    setupGlobalEventListeners();

    // Check user authentication
    await Auth.checkAuth();
  };

  const setupGlobalEventListeners = () => {
    // View Switcher Tabs
    const tabKanban = document.getElementById('tabKanban');
    const tabDashboard = document.getElementById('tabDashboard');
    const tabMembers = document.getElementById('tabMembers');

    tabKanban.addEventListener('click', () => switchView('kanban'));
    tabDashboard.addEventListener('click', () => switchView('dashboard'));
    tabMembers.addEventListener('click', () => switchView('members'));

    // Project Dropdown Toggle
    const projectSelectorBtn = document.getElementById('projectSelectorBtn');
    const projectDropdownMenu = document.getElementById('projectDropdownMenu');

    projectSelectorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      projectDropdownMenu.classList.toggle('hidden');
      document.getElementById('userDropdownMenu').classList.add('hidden');
      document.getElementById('notificationsDropdown').classList.add('hidden');
    });

    // User Profile Dropdown Toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');

    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('hidden');
      document.getElementById('projectDropdownMenu').classList.add('hidden');
      document.getElementById('notificationsDropdown').classList.add('hidden');
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!projectSelectorBtn.contains(e.target) && !projectDropdownMenu.contains(e.target)) {
        projectDropdownMenu.classList.add('hidden');
      }
      if (!userMenuBtn.contains(e.target) && !userDropdownMenu.contains(e.target)) {
        userDropdownMenu.classList.add('hidden');
      }
    });

    // Open Modals
    document.getElementById('btnOpenNewTaskModal').addEventListener('click', () => {
      const modal = document.getElementById('createTaskModal');
      modal.classList.remove('hidden');
      document.getElementById('newTaskTitle').focus();
    });

    document.getElementById('btnOpenAddColumnModal').addEventListener('click', () => {
      const modal = document.getElementById('addColumnModal');
      modal.classList.remove('hidden');
      document.getElementById('newColumnName').focus();
    });

    document.getElementById('btnOpenInviteModal').addEventListener('click', () => {
      const modal = document.getElementById('inviteMemberModal');
      modal.classList.remove('hidden');
      document.getElementById('inviteEmail').focus();
    });

    document.getElementById('btnInviteMemberHeader').addEventListener('click', () => {
      const modal = document.getElementById('inviteMemberModal');
      modal.classList.remove('hidden');
      document.getElementById('inviteEmail').focus();
    });

    document.getElementById('btnOpenNewProjectModal').addEventListener('click', () => {
      projectDropdownMenu.classList.add('hidden');
      const modal = document.getElementById('createProjectModal');
      modal.classList.remove('hidden');
      document.getElementById('newProjectName').focus();
    });

    // Project Settings Modal
    const btnProjectSettings = document.getElementById('btnOpenProjectSettingsModal');
    btnProjectSettings.addEventListener('click', () => {
      if (!activeProject) return;
      document.getElementById('editProjectName').value = activeProject.name;
      document.getElementById('editProjectDesc').value = activeProject.description || '';
      document.getElementById('projectSettingsModal').classList.remove('hidden');
    });

    // Create Project Form Submit
    const createProjectForm = document.getElementById('createProjectForm');
    createProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newProjectName').value.trim();
      const description = document.getElementById('newProjectDesc').value.trim();

      try {
        const res = await API.projects.create({ name, description });
        showToast('Project Created', `Project "${res.project.name}" created successfully.`, 'success');
        closeAllModals();
        createProjectForm.reset();
        await loadProjects(res.project._id);
      } catch (err) {
        showToast('Error', err.message, 'danger');
      }
    });

    // Edit Project Settings Form Submit
    const projectSettingsForm = document.getElementById('projectSettingsForm');
    projectSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProject) return;

      const name = document.getElementById('editProjectName').value.trim();
      const description = document.getElementById('editProjectDesc').value.trim();

      try {
        const res = await API.projects.update(activeProject._id, { name, description });
        showToast('Settings Saved', 'Project details updated.', 'success');
        closeAllModals();
        activeProject = res.project;
        Board.setProject(activeProject);
        await loadProjects(activeProject._id);
      } catch (err) {
        showToast('Error', err.message, 'danger');
      }
    });

    // Delete Project Button
    const btnDeleteCurrentProject = document.getElementById('btnDeleteCurrentProject');
    btnDeleteCurrentProject.addEventListener('click', async () => {
      if (!activeProject) return;
      if (!confirm(`Are you sure you want to permanently delete project "${activeProject.name}"? This cannot be undone.`)) return;

      try {
        await API.projects.delete(activeProject._id);
        showToast('Project Deleted', 'Project was permanently deleted.', 'info');
        closeAllModals();
        activeProjectId = null;
        await loadProjects();
      } catch (err) {
        showToast('Error', err.message, 'danger');
      }
    });

    // Invite Member Form Submit
    const inviteMemberForm = document.getElementById('inviteMemberForm');
    inviteMemberForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProject) return;

      const email = document.getElementById('inviteEmail').value.trim();
      const role = document.getElementById('inviteRole').value;

      try {
        await API.projects.inviteMember(activeProject._id, email, role);
        showToast('Member Added', `${email} has been added to the project.`, 'success');
        closeAllModals();
        inviteMemberForm.reset();
        // Refresh project data
        await switchProject(activeProject._id);
      } catch (err) {
        showToast('Invite Failed', err.message, 'danger');
      }
    });
  };

  const onAuthenticated = async (user, token) => {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');

    // Update Top Nav User Profile
    const avatar = document.getElementById('currentUserAvatar');
    const name = document.getElementById('currentUserName');
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');

    if (avatar) {
      avatar.textContent = getInitials(user.name);
      avatar.style.background = user.avatarColor || '#6366f1';
    }
    if (name) name.textContent = user.name;
    if (dropdownName) dropdownName.textContent = user.name;
    if (dropdownEmail) dropdownEmail.textContent = user.email;

    // Connect Socket.io
    AppSocket.init(token);

    // Load initial notifications
    Notifications.loadNotifications();

    // Load projects
    await loadProjects();
  };

  const loadProjects = async (selectProjectId = null) => {
    try {
      const res = await API.projects.getAll();
      projectsList = res.projects || [];
      renderProjectSelectorList();

      if (projectsList.length > 0) {
        const targetId = selectProjectId || activeProjectId || projectsList[0]._id;
        await switchProject(targetId);
      } else {
        document.getElementById('activeProjectName').textContent = 'No Projects Found';
        showToast('No Projects', 'Create a new project to get started!', 'info');
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const renderProjectSelectorList = () => {
    const list = document.getElementById('projectListItems');
    if (!list) return;

    list.innerHTML = projectsList
      .map((p) => {
        const isActive = p._id === activeProjectId;
        return `
          <button type="button" class="dropdown-item ${isActive ? 'active' : ''}" data-project-id="${p._id}">
            <i class="fa-solid fa-folder text-primary"></i>
            <span>${escapeHtml(p.name)}</span>
            <small class="text-dim" style="margin-left:auto">${p.taskCount || 0} tasks</small>
          </button>
        `;
      })
      .join('');

    list.querySelectorAll('.dropdown-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-project-id');
        document.getElementById('projectDropdownMenu').classList.add('hidden');
        await switchProject(id);
      });
    });
  };

  const switchProject = async (projectId) => {
    try {
      activeProjectId = projectId;
      const res = await API.projects.getById(projectId);
      activeProject = res.project;

      document.getElementById('activeProjectName').textContent = activeProject.name;
      document.getElementById('memberCountBadge').textContent = (activeProject.members || []).length;

      // Update project list dropdown active state
      renderProjectSelectorList();

      // Join socket room for this project
      AppSocket.joinProject(projectId);

      // Pass project to Board module
      await Board.setProject(activeProject);

      // Render team members view
      renderMembersView();

      // If currently on dashboard, refresh dashboard
      if (currentView === 'dashboard') {
        Dashboard.loadDashboard();
      }
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  };

  const switchView = (viewName) => {
    currentView = viewName;

    // Update tab active classes
    document.getElementById('tabKanban').classList.toggle('active', viewName === 'kanban');
    document.getElementById('tabDashboard').classList.toggle('active', viewName === 'dashboard');
    document.getElementById('tabMembers').classList.toggle('active', viewName === 'members');

    // Show/hide view content containers
    document.getElementById('kanbanView').classList.toggle('hidden', viewName !== 'kanban');
    document.getElementById('dashboardView').classList.toggle('hidden', viewName !== 'dashboard');
    document.getElementById('membersView').classList.toggle('hidden', viewName !== 'members');

    if (viewName === 'dashboard') {
      Dashboard.loadDashboard();
    } else if (viewName === 'members') {
      renderMembersView();
    }
  };

  const renderMembersView = () => {
    const tableBody = document.getElementById('membersTableBody');
    if (!tableBody || !activeProject) return;

    const members = activeProject.members || [];
    const currentUser = Auth.getUser();
    const isOwner = activeProject.userRole === 'owner';

    tableBody.innerHTML = members
      .map((m) => {
        if (!m.user) return '';
        const memberUser = m.user;
        const initials = getInitials(memberUser.name);
        const rolePill = m.role === 'owner'
          ? '<span class="badge badge-owner">Owner</span>'
          : '<span class="badge badge-member">Member</span>';
        const joinedDate = new Date(m.joinedAt || Date.now()).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        const canRemove = isOwner && m.role !== 'owner' && memberUser._id !== currentUser._id;

        return `
          <tr>
            <td>
              <div class="member-cell">
                <div class="user-avatar" style="background:${memberUser.avatarColor || '#6366f1'}">${initials}</div>
                <strong>${escapeHtml(memberUser.name)}</strong>
              </div>
            </td>
            <td><span class="text-muted">${escapeHtml(memberUser.email)}</span></td>
            <td>${rolePill}</td>
            <td><span class="text-dim">${joinedDate}</span></td>
            <td>
              ${
                canRemove
                  ? `<button type="button" class="btn btn-sm btn-danger-outline btn-remove-member" data-id="${memberUser._id}">
                      <i class="fa-solid fa-user-minus"></i> Remove
                     </button>`
                  : '<span class="text-dim">—</span>'
              }
            </td>
          </tr>
        `;
      })
      .join('');

    // Attach removal handlers
    tableBody.querySelectorAll('.btn-remove-member').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id');
        if (!confirm('Are you sure you want to remove this member from the project?')) return;

        try {
          await API.projects.removeMember(activeProject._id, userId);
          showToast('Member Removed', 'Team member was removed from project.', 'info');
          await switchProject(activeProject._id);
        } catch (err) {
          showToast('Error', err.message, 'danger');
        }
      });
    });
  };

  const onSocketMembersUpdated = (members) => {
    if (activeProject) {
      activeProject.members = members;
      document.getElementById('memberCountBadge').textContent = members.length;
      Board.setProject(activeProject);
      renderMembersView();
    }
  };

  // ==================== TOAST SYSTEM ====================
  const showToast = (title, message, type = 'info', onClickAction = null) => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-solid fa-circle-info text-primary';
    if (type === 'success') icon = 'fa-solid fa-circle-check text-success';
    if (type === 'danger') icon = 'fa-solid fa-circle-exclamation text-danger';
    if (type === 'warning') icon = 'fa-solid fa-triangle-exclamation text-warning';

    toast.innerHTML = `
      <div class="toast-icon"><i class="${icon}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
    `;

    if (onClickAction) {
      toast.style.cursor = 'pointer';
      toast.addEventListener('click', () => {
        onClickAction();
        toast.remove();
      });
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  };

  const closeAllModals = () => {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
  };

  const getActiveProjectId = () => activeProjectId;

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
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
    onAuthenticated,
    switchProject,
    switchView,
    getActiveProjectId,
    onSocketMembersUpdated,
    showToast,
  };
})();

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
