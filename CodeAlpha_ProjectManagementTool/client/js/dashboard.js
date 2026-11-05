/**
 * CodeAlpha Boards — Dashboard Controller
 */

const Dashboard = (() => {
  let dashboardData = null;

  const init = () => {
    setupEventListeners();
  };

  const setupEventListeners = () => {
    const tabMyTasks = document.getElementById('dashTabMyTasks');
    const tabDueSoon = document.getElementById('dashTabDueSoon');
    const myTasksContainer = document.getElementById('dashMyTasksContainer');
    const dueSoonContainer = document.getElementById('dashDueSoonContainer');

    tabMyTasks.addEventListener('click', () => {
      tabMyTasks.classList.add('active');
      tabDueSoon.classList.remove('active');
      myTasksContainer.classList.remove('hidden');
      dueSoonContainer.classList.add('hidden');
    });

    tabDueSoon.addEventListener('click', () => {
      tabDueSoon.classList.add('active');
      tabMyTasks.classList.remove('active');
      dueSoonContainer.classList.remove('hidden');
      myTasksContainer.classList.add('hidden');
    });
  };

  const loadDashboard = async () => {
    try {
      const res = await API.dashboard.getData();
      dashboardData = res;
      renderMetrics(res.stats);
      renderProjectProgress(res.projectProgress || []);
      renderMyTasks(res.myTasks || []);
      renderDueSoonTasks([...(res.overdueTasks || []), ...(res.dueSoonTasks || [])]);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      App.showToast('Dashboard Error', err.message, 'danger');
    }
  };

  const renderMetrics = (stats = {}) => {
    document.getElementById('metricTotalProjects').textContent = stats.totalProjects || 0;
    document.getElementById('metricAssignedTasks').textContent = stats.totalAssignedTasks || 0;
    document.getElementById('metricInProgressTasks').textContent = stats.inProgressAssignedTasks || 0;
    document.getElementById('metricCompletedTasks').textContent = stats.completedAssignedTasks || 0;
    document.getElementById('metricDueSoonOverdue').textContent = (stats.dueSoonCount || 0) + (stats.overdueCount || 0);
  };

  const renderProjectProgress = (progressList) => {
    const container = document.getElementById('dashboardProjectProgressList');
    if (!container) return;

    if (progressList.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">No active projects found.</div>';
      return;
    }

    container.innerHTML = progressList
      .map((p) => {
        const percent = p.completionPercentage || 0;
        return `
          <div class="project-progress-item">
            <div class="progress-header">
              <span class="progress-name">${escapeHtml(p.name)}</span>
              <span class="progress-percent">${percent}% Complete</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="progress-details">
              <span>${p.completedTasks} of ${p.totalTasks} tasks completed</span>
              <span>${p.inProgressTasks} in progress • ${p.todoTasks} to do</span>
            </div>
          </div>
        `;
      })
      .join('');
  };

  const renderMyTasks = (tasksList) => {
    const container = document.getElementById('dashMyTasksContainer');
    if (!container) return;

    if (tasksList.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">You have no tasks assigned to you right now. Great job!</div>';
      return;
    }

    container.innerHTML = tasksList
      .map((t) => renderDashboardTaskItem(t))
      .join('');

    attachTaskItemClicks(container);
  };

  const renderDueSoonTasks = (tasksList) => {
    const container = document.getElementById('dashDueSoonContainer');
    if (!container) return;

    if (tasksList.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">No tasks are due soon or overdue!</div>';
      return;
    }

    container.innerHTML = tasksList
      .map((t) => renderDashboardTaskItem(t, true))
      .join('');

    attachTaskItemClicks(container);
  };

  const renderDashboardTaskItem = (task, isUrgentWatch = false) => {
    const projectName = task.project ? task.project.name : 'Unknown Project';
    const priorityClass = task.priority || 'medium';
    const dueFormatted = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'No due date';

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

    return `
      <div class="dash-task-item" data-project-id="${task.project ? task.project._id : ''}" data-task-id="${task._id}">
        <div class="dash-task-left">
          <span class="dash-task-title">${escapeHtml(task.title)}</span>
          <span class="dash-task-project"><i class="fa-solid fa-folder text-primary"></i> ${escapeHtml(projectName)}</span>
        </div>
        <div class="dash-task-right">
          <span class="badge-priority ${priorityClass}">${priorityClass}</span>
          <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
            <i class="fa-regular fa-calendar"></i> ${dueFormatted}
          </span>
        </div>
      </div>
    `;
  };

  const attachTaskItemClicks = (container) => {
    container.querySelectorAll('.dash-task-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const projectId = item.getAttribute('data-project-id');
        const taskId = item.getAttribute('data-task-id');

        if (projectId && projectId !== App.getActiveProjectId()) {
          await App.switchProject(projectId);
        }

        // Switch to Kanban view and open modal
        App.switchView('kanban');
        setTimeout(() => {
          Board.openTaskModal(taskId);
        }, 200);
      });
    });
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
    loadDashboard,
  };
})();
