/**
 * CodeAlpha Boards — Kanban Board Controller
 */

const Board = (() => {
  let currentProject = null;
  let tasks = [];
  let currentTaskIdInModal = null;
  let draggedTaskId = null;
  let typingTimeout = null;

  const init = () => {
    setupEventListeners();
  };

  const setupEventListeners = () => {
    // Search input
    const searchInput = document.getElementById('taskSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const prioritySelect = document.getElementById('priorityFilterSelect');
    const assigneeSelect = document.getElementById('assigneeFilterSelect');

    searchInput.addEventListener('input', () => {
      clearSearchBtn.classList.toggle('hidden', !searchInput.value.trim());
      applyFiltersAndRender();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      applyFiltersAndRender();
    });

    prioritySelect.addEventListener('change', applyFiltersAndRender);
    assigneeSelect.addEventListener('change', applyFiltersAndRender);

    // Modal Close Buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeAllModals();
      });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeAllModals();
        }
      });
    });

    // Create Task Modal Form
    const createTaskForm = document.getElementById('createTaskForm');
    createTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentProject) return;

      const title = document.getElementById('newTaskTitle').value.trim();
      const status = document.getElementById('newTaskStatus').value;
      const priority = document.getElementById('newTaskPriority').value;
      const assignee = document.getElementById('newTaskAssignee').value || null;
      const dueDate = document.getElementById('newTaskDueDate').value || null;
      const labelsRaw = document.getElementById('newTaskLabels').value;
      const description = document.getElementById('newTaskDescription').value.trim();

      const labels = labelsRaw
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l.length > 0);

      try {
        await API.tasks.create({
          projectId: currentProject._id,
          title,
          status,
          priority,
          assignee,
          dueDate,
          labels,
          description,
        });

        closeAllModals();
        createTaskForm.reset();
        App.showToast('Task Created', `"${title}" has been added to the board.`, 'success');
      } catch (err) {
        App.showToast('Error', err.message, 'danger');
      }
    });

    // Add Column Form
    const addColumnForm = document.getElementById('addColumnForm');
    addColumnForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentProject) return;

      const name = document.getElementById('newColumnName').value.trim();
      try {
        await API.projects.addColumn(currentProject._id, name);
        closeAllModals();
        addColumnForm.reset();
        App.showToast('Column Added', `"${name}" column created.`, 'success');
      } catch (err) {
        App.showToast('Error', err.message, 'danger');
      }
    });

    // Task Detail Save Changes Button
    const btnSaveTaskDetails = document.getElementById('btnSaveTaskDetails');
    btnSaveTaskDetails.addEventListener('click', async () => {
      if (!currentTaskIdInModal) return;

      const title = document.getElementById('detailTaskTitle').value.trim();
      const description = document.getElementById('detailTaskDescription').value.trim();
      const status = document.getElementById('detailTaskStatus').value;
      const priority = document.getElementById('detailTaskPriority').value;
      const assignee = document.getElementById('detailTaskAssignee').value || null;
      const dueDate = document.getElementById('detailTaskDueDate').value || null;
      const labelsRaw = document.getElementById('detailTaskLabels').value;

      const labels = labelsRaw
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l.length > 0);

      try {
        await API.tasks.update(currentTaskIdInModal, {
          title,
          description,
          status,
          priority,
          assignee,
          dueDate,
          labels,
        });

        App.showToast('Saved', 'Task details updated successfully.', 'success');
        closeAllModals();
      } catch (err) {
        App.showToast('Error', err.message, 'danger');
      }
    });

    // Delete Task Button
    const btnDeleteTask = document.getElementById('btnDeleteTask');
    btnDeleteTask.addEventListener('click', async () => {
      if (!currentTaskIdInModal) return;
      if (!confirm('Are you sure you want to permanently delete this task?')) return;

      try {
        await API.tasks.delete(currentTaskIdInModal);
        closeAllModals();
        App.showToast('Task Deleted', 'Task has been removed from board.', 'info');
      } catch (err) {
        App.showToast('Error', err.message, 'danger');
      }
    });

    // Add Comment Form
    const addCommentForm = document.getElementById('addCommentForm');
    addCommentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTaskIdInModal) return;

      const commentInput = document.getElementById('commentTextInput');
      const text = commentInput.value.trim();
      if (!text) return;

      try {
        await API.comments.add(currentTaskIdInModal, text);
        commentInput.value = '';
        AppSocket.emitTyping(currentProject._id, currentTaskIdInModal, false);
      } catch (err) {
        App.showToast('Error', err.message, 'danger');
      }
    });

    // Comment Typing Indicator Emission
    const commentInput = document.getElementById('commentTextInput');
    commentInput.addEventListener('input', () => {
      if (!currentProject || !currentTaskIdInModal) return;

      AppSocket.emitTyping(currentProject._id, currentTaskIdInModal, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        AppSocket.emitTyping(currentProject._id, currentTaskIdInModal, false);
      }, 1500);
    });
  };

  const setProject = async (project) => {
    currentProject = project;
    updateProjectHeader();
    populateAssigneeSelects();
    populateColumnSelects();
    await loadTasks();
  };

  const updateProjectHeader = () => {
    if (!currentProject) return;

    document.getElementById('headerProjectTitle').textContent = currentProject.name;
    document.getElementById('headerProjectDesc').textContent = currentProject.description || 'No description provided';

    const roleBadge = document.getElementById('headerRoleBadge');
    const isOwner = currentProject.userRole === 'owner';
    roleBadge.className = isOwner ? 'badge badge-owner' : 'badge badge-member';
    roleBadge.textContent = isOwner ? 'Owner' : 'Member';

    // Show/hide owner-only controls
    const btnInvite = document.getElementById('btnOpenInviteModal');
    const btnAddColumn = document.getElementById('btnOpenAddColumnModal');
    const btnProjectSettings = document.getElementById('btnOpenProjectSettingsModal');

    // Both owner and members can add columns/tasks; owner can manage settings & invite
    btnProjectSettings.classList.toggle('hidden', !isOwner);
  };

  const populateColumnSelects = () => {
    if (!currentProject || !currentProject.columns) return;

    const newTaskStatus = document.getElementById('newTaskStatus');
    const detailTaskStatus = document.getElementById('detailTaskStatus');

    const optionsHtml = currentProject.columns
      .map((col) => `<option value="${col.id}">${escapeHtml(col.name)}</option>`)
      .join('');

    if (newTaskStatus) newTaskStatus.innerHTML = optionsHtml;
    if (detailTaskStatus) detailTaskStatus.innerHTML = optionsHtml;
  };

  const populateAssigneeSelects = () => {
    if (!currentProject) return;

    const newTaskAssignee = document.getElementById('newTaskAssignee');
    const detailTaskAssignee = document.getElementById('detailTaskAssignee');
    const assigneeFilter = document.getElementById('assigneeFilterSelect');

    let membersOptions = '<option value="">Unassigned</option>';
    if (currentProject.members && Array.isArray(currentProject.members)) {
      currentProject.members.forEach((m) => {
        if (m.user) {
          membersOptions += `<option value="${m.user._id}">${escapeHtml(m.user.name)} (${escapeHtml(m.user.email)})</option>`;
        }
      });
    }

    if (newTaskAssignee) newTaskAssignee.innerHTML = membersOptions;
    if (detailTaskAssignee) detailTaskAssignee.innerHTML = membersOptions;

    // Filter dropdown
    let filterOptions = `
      <option value="">All Assignees</option>
      <option value="me">Assigned to Me</option>
      <option value="unassigned">Unassigned</option>
    `;
    if (currentProject.members) {
      currentProject.members.forEach((m) => {
        if (m.user) {
          filterOptions += `<option value="${m.user._id}">${escapeHtml(m.user.name)}</option>`;
        }
      });
    }
    if (assigneeFilter) assigneeFilter.innerHTML = filterOptions;
  };

  const loadTasks = async () => {
    if (!currentProject) return;

    try {
      const res = await API.tasks.getAll(currentProject._id);
      tasks = res.tasks || [];
      renderBoard();
    } catch (err) {
      App.showToast('Failed to load tasks', err.message, 'danger');
    }
  };

  const applyFiltersAndRender = () => {
    renderBoard();
  };

  const getFilteredTasks = () => {
    const searchVal = document.getElementById('taskSearchInput').value.trim().toLowerCase();
    const priorityVal = document.getElementById('priorityFilterSelect').value;
    const assigneeVal = document.getElementById('assigneeFilterSelect').value;
    const currentUser = Auth.getUser();

    return tasks.filter((task) => {
      // Text search in title or labels
      if (searchVal) {
        const titleMatch = task.title.toLowerCase().includes(searchVal);
        const labelMatch = (task.labels || []).some((l) => l.toLowerCase().includes(searchVal));
        const descMatch = (task.description || '').toLowerCase().includes(searchVal);
        if (!titleMatch && !labelMatch && !descMatch) return false;
      }

      // Priority filter
      if (priorityVal && task.priority !== priorityVal) {
        return false;
      }

      // Assignee filter
      if (assigneeVal) {
        if (assigneeVal === 'unassigned') {
          if (task.assignee) return false;
        } else if (assigneeVal === 'me') {
          if (!task.assignee || !currentUser || task.assignee._id !== currentUser._id) {
            return false;
          }
        } else {
          if (!task.assignee || task.assignee._id !== assigneeVal) {
            return false;
          }
        }
      }

      return true;
    });
  };

  const renderBoard = () => {
    const container = document.getElementById('boardColumnsContainer');
    if (!container || !currentProject) return;

    const filtered = getFilteredTasks();
    const columns = currentProject.columns || [];

    // Group tasks by column status
    const tasksByColumn = {};
    columns.forEach((col) => {
      tasksByColumn[col.id] = [];
    });

    filtered.forEach((task) => {
      if (tasksByColumn[task.status]) {
        tasksByColumn[task.status].push(task);
      } else {
        // Fallback into first column if status column was deleted
        const firstColId = columns[0]?.id || 'todo';
        if (!tasksByColumn[firstColId]) tasksByColumn[firstColId] = [];
        tasksByColumn[firstColId].push(task);
      }
    });

    // Build columns HTML
    container.innerHTML = columns
      .map((col) => {
        const colTasks = tasksByColumn[col.id] || [];
        const isCustomCol = !['todo', 'in_progress', 'done'].includes(col.id);

        return `
          <div class="board-column" data-column-id="${col.id}">
            <div class="column-header">
              <div class="column-header-left">
                <span class="column-title">${escapeHtml(col.name)}</span>
                <span class="column-count-badge">${colTasks.length}</span>
              </div>
              <div class="column-header-actions">
                <button type="button" class="column-btn btn-add-task-col" data-col="${col.id}" title="Add Task to this column">
                  <i class="fa-solid fa-plus"></i>
                </button>
                ${
                  isCustomCol
                    ? `<button type="button" class="column-btn btn-delete-col" data-col="${col.id}" title="Delete Column">
                        <i class="fa-regular fa-trash-can text-danger"></i>
                       </button>`
                    : ''
                }
              </div>
            </div>

            <!-- Drop Zone for Tasks -->
            <div class="column-drop-zone" data-column-id="${col.id}">
              ${colTasks.map((t) => renderTaskCard(t)).join('')}
            </div>
          </div>
        `;
      })
      .join('');

    setupDragAndDrop();
    setupCardClickHandlers();
    setupColumnActionHandlers();
  };

  const renderTaskCard = (task) => {
    const priorityClass = task.priority || 'medium';
    const dueInfo = formatDueDate(task.dueDate);
    const commentCount = task.commentCount || 0;

    let assigneeAvatarHtml = `
      <div class="task-unassigned-avatar" title="Unassigned">
        <i class="fa-regular fa-user"></i>
      </div>
    `;

    if (task.assignee) {
      const initials = getInitials(task.assignee.name);
      assigneeAvatarHtml = `
        <div class="task-assignee-avatar" style="background:${task.assignee.avatarColor || '#6366f1'};" title="Assigned to ${escapeHtml(task.assignee.name)}">
          ${initials}
        </div>
      `;
    }

    const labelsHtml = (task.labels || [])
      .map((l) => `<span class="task-label-tag">#${escapeHtml(l)}</span>`)
      .join('');

    return `
      <div class="task-card" draggable="true" data-task-id="${task._id}">
        <div class="task-card-header">
          <span class="badge-priority ${priorityClass}">${priorityClass}</span>
          ${labelsHtml ? `<div class="task-labels-row">${labelsHtml}</div>` : ''}
        </div>

        <h3 class="task-card-title">${escapeHtml(task.title)}</h3>

        <div class="task-card-footer">
          <div class="task-meta-left">
            ${
              dueInfo
                ? `<span class="task-due-date ${dueInfo.statusClass}">
                    <i class="fa-regular fa-calendar"></i> ${dueInfo.formatted}
                   </span>`
                : ''
            }
            <span class="task-comments-indicator" title="${commentCount} comments">
              <i class="fa-regular fa-comment"></i> ${commentCount}
            </span>
          </div>
          <div class="task-meta-right">
            ${assigneeAvatarHtml}
          </div>
        </div>
      </div>
    `;
  };

  // ==================== DRAG & DROP ENGINE ====================
  const setupDragAndDrop = () => {
    const cards = document.querySelectorAll('.task-card');
    const dropZones = document.querySelectorAll('.column-drop-zone');

    cards.forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        draggedTaskId = card.getAttribute('data-task-id');
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTaskId);

        // Highlight all drop zones
        dropZones.forEach((dz) => dz.classList.add('drag-active'));
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedTaskId = null;
        dropZones.forEach((dz) => {
          dz.classList.remove('drag-active');
          dz.classList.remove('drag-over');
          removeDropIndicators(dz);
        });
      });
    });

    dropZones.forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');

        const afterElement = getDragAfterElement(zone, e.clientY);
        removeDropIndicators(zone);

        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';

        if (afterElement == null) {
          zone.appendChild(indicator);
        } else {
          zone.insertBefore(indicator, afterElement);
        }
      });

      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('drag-over');
          removeDropIndicators(zone);
        }
      });

      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        removeDropIndicators(zone);

        const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
        const newStatus = zone.getAttribute('data-column-id');

        if (!taskId || !newStatus) return;

        const task = tasks.find((t) => t._id === taskId);
        if (!task) return;

        // Calculate new order index in destination column
        const afterElement = getDragAfterElement(zone, e.clientY);
        let newOrder = 0;

        const siblingCards = [...zone.querySelectorAll('.task-card:not(.dragging)')];
        if (afterElement == null) {
          newOrder = siblingCards.length;
        } else {
          const idx = siblingCards.indexOf(afterElement);
          newOrder = idx >= 0 ? idx : 0;
        }

        // Optimistic UI update
        task.status = newStatus;
        task.order = newOrder;
        renderBoard();

        try {
          await API.tasks.move(taskId, newStatus, newOrder);
        } catch (err) {
          App.showToast('Failed to move task', err.message, 'danger');
          loadTasks(); // Rollback on error
        }
      });
    });
  };

  const getDragAfterElement = (container, y) => {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  };

  const removeDropIndicators = (container) => {
    container.querySelectorAll('.drop-indicator').forEach((el) => el.remove());
  };

  // Card click handlers to open Detail Modal
  const setupCardClickHandlers = () => {
    document.querySelectorAll('.task-card').forEach((card) => {
      card.addEventListener('click', () => {
        const taskId = card.getAttribute('data-task-id');
        openTaskModal(taskId);
      });
    });
  };

  const setupColumnActionHandlers = () => {
    // Quick Add Task to specific column
    document.querySelectorAll('.btn-add-task-col').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const colId = btn.getAttribute('data-col');
        const modal = document.getElementById('createTaskModal');
        const statusSelect = document.getElementById('newTaskStatus');
        if (statusSelect) statusSelect.value = colId;
        modal.classList.remove('hidden');
      });
    });

    // Delete custom column
    document.querySelectorAll('.btn-delete-col').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const colId = btn.getAttribute('data-col');
        if (!confirm('Are you sure you want to remove this column? Tasks inside it will be moved to the first column.')) return;

        try {
          await API.projects.deleteColumn(currentProject._id, colId);
          App.showToast('Column Removed', 'Column was removed successfully.', 'info');
        } catch (err) {
          App.showToast('Error', err.message, 'danger');
        }
      });
    });
  };

  // ==================== TASK DETAIL MODAL & COMMENTS ====================
  const openTaskModal = async (taskId) => {
    currentTaskIdInModal = taskId;
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;

    const modal = document.getElementById('taskDetailModal');
    document.getElementById('detailTaskTitle').value = task.title;
    document.getElementById('detailTaskDescription').value = task.description || '';
    document.getElementById('detailTaskStatus').value = task.status;
    document.getElementById('detailTaskPriority').value = task.priority || 'medium';
    document.getElementById('detailTaskAssignee').value = task.assignee ? task.assignee._id : '';
    document.getElementById('detailTaskDueDate').value = task.dueDate ? task.dueDate.split('T')[0] : '';
    document.getElementById('detailTaskLabels').value = (task.labels || []).join(', ');

    // Badges in header
    const statusCol = currentProject.columns?.find((c) => c.id === task.status);
    document.getElementById('modalTaskStatusBadge').textContent = statusCol ? statusCol.name : task.status;
    document.getElementById('modalTaskPriorityBadge').textContent = `${task.priority.toUpperCase()} PRIORITY`;
    document.getElementById('modalTaskPriorityBadge').className = `badge badge-priority ${task.priority}`;

    modal.classList.remove('hidden');

    // Load comments
    await loadCommentsForModal(taskId);
  };

  const loadCommentsForModal = async (taskId) => {
    try {
      const res = await API.comments.get(taskId);
      const comments = res.comments || [];
      document.getElementById('modalCommentCount').textContent = comments.length;
      renderCommentsList(comments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const renderCommentsList = (comments) => {
    const list = document.getElementById('commentsList');
    if (!list) return;

    if (comments.length === 0) {
      list.innerHTML = '<div class="empty-state-sm">No comments yet. Be the first to start the conversation!</div>';
      return;
    }

    const currentUser = Auth.getUser();

    list.innerHTML = comments
      .map((c) => {
        const authorName = c.author ? c.author.name : 'Unknown';
        const authorColor = c.author ? c.author.avatarColor || '#6366f1' : '#6366f1';
        const initials = getInitials(authorName);
        const timeAgo = formatTimeAgo(new Date(c.createdAt));
        const canDelete = currentUser && (c.author._id === currentUser._id || currentProject.userRole === 'owner');

        return `
          <div class="comment-card" data-comment-id="${c._id}">
            <div class="comment-author-avatar" style="background:${authorColor}">${initials}</div>
            <div class="comment-body">
              <div class="comment-meta">
                <span class="comment-author-name">${escapeHtml(authorName)}</span>
                <div>
                  <span class="comment-time">${timeAgo}</span>
                  ${
                    canDelete
                      ? `<button type="button" class="btn-text-sm text-danger btn-delete-comment" data-id="${c._id}" style="margin-left:0.5rem" title="Delete Comment">
                          <i class="fa-regular fa-trash-can"></i>
                         </button>`
                      : ''
                  }
                </div>
              </div>
              <div class="comment-text">${escapeHtml(c.text)}</div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach comment deletion handlers
    list.querySelectorAll('.btn-delete-comment').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await API.comments.delete(id);
          // Socket event will update UI, or we can reload
        } catch (err) {
          App.showToast('Error', err.message, 'danger');
        }
      });
    });

    // Scroll to bottom of comments
    list.scrollTop = list.scrollHeight;
  };

  const closeAllModals = () => {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
    currentTaskIdInModal = null;
  };

  // ==================== REAL-TIME SOCKET HANDLERS ====================
  const onSocketTaskCreated = (task) => {
    if (!currentProject || task.project !== currentProject._id) return;
    const existingIdx = tasks.findIndex((t) => t._id === task._id);
    if (existingIdx === -1) {
      tasks.push(task);
      renderBoard();
      App.showToast('New Task', `"${task.title}" was added by team member.`, 'info');
    }
  };

  const onSocketTaskUpdated = (task) => {
    if (!currentProject || task.project !== currentProject._id) return;
    const idx = tasks.findIndex((t) => t._id === task._id);
    if (idx !== -1) {
      tasks[idx] = task;
      renderBoard();

      // If active in modal, update modal fields
      if (currentTaskIdInModal === task._id) {
        document.getElementById('detailTaskTitle').value = task.title;
        document.getElementById('detailTaskDescription').value = task.description || '';
        document.getElementById('detailTaskStatus').value = task.status;
        document.getElementById('detailTaskPriority').value = task.priority || 'medium';
      }
    }
  };

  const onSocketTaskMoved = (data) => {
    if (!currentProject) return;
    const { taskId, newStatus, order, movedBy } = data;
    const task = tasks.find((t) => t._id === taskId);
    if (task) {
      task.status = newStatus;
      task.order = order;
      renderBoard();

      // Notify if moved by teammate
      const currentUser = Auth.getUser();
      if (movedBy && currentUser && movedBy.id !== currentUser._id) {
        const col = currentProject.columns?.find((c) => c.id === newStatus);
        const colName = col ? col.name : newStatus;
        App.showToast('Task Moved', `${movedBy.name} moved "${task.title}" to ${colName}`, 'info');
      }
    }
  };

  const onSocketTaskDeleted = (data) => {
    const { taskId } = data;
    tasks = tasks.filter((t) => t._id !== taskId);
    renderBoard();

    if (currentTaskIdInModal === taskId) {
      closeAllModals();
      App.showToast('Task Deleted', 'The task you were viewing was removed.', 'info');
    }
  };

  const onSocketColumnsUpdated = (columns) => {
    if (!currentProject) return;
    currentProject.columns = columns;
    populateColumnSelects();
    renderBoard();
  };

  const onSocketTasksReloaded = (newTasks) => {
    tasks = newTasks;
    renderBoard();
  };

  const onSocketCommentAdded = (data) => {
    const { taskId, comment } = data;
    // Update task's comment count
    const task = tasks.find((t) => t._id === taskId);
    if (task) {
      task.commentCount = (task.commentCount || 0) + 1;
      renderBoard();
    }

    // If modal is open for this task, reload comments list
    if (currentTaskIdInModal === taskId) {
      loadCommentsForModal(taskId);
    }
  };

  const onSocketCommentDeleted = (data) => {
    const { taskId } = data;
    const task = tasks.find((t) => t._id === taskId);
    if (task) {
      task.commentCount = Math.max(0, (task.commentCount || 1) - 1);
      renderBoard();
    }

    if (currentTaskIdInModal === taskId) {
      loadCommentsForModal(taskId);
    }
  };

  const onSocketUserTyping = (data) => {
    const { taskId, user, isTyping } = data;
    const indicator = document.getElementById('commentTypingIndicator');
    if (!indicator || currentTaskIdInModal !== taskId) return;

    if (isTyping) {
      indicator.innerHTML = `<span></span> ${escapeHtml(user.name)} is typing...`;
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  };

  // ==================== HELPERS ====================
  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    const options = { month: 'short', day: 'numeric' };
    const formatted = date.toLocaleDateString(undefined, options);

    let statusClass = '';
    if (date < now) {
      statusClass = 'overdue';
    } else if (diffDays <= 2) {
      statusClass = 'due-soon';
    }

    return { formatted, statusClass };
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
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
    setProject,
    loadTasks,
    openTaskModal,
    onSocketTaskCreated,
    onSocketTaskUpdated,
    onSocketTaskMoved,
    onSocketTaskDeleted,
    onSocketColumnsUpdated,
    onSocketTasksReloaded,
    onSocketCommentAdded,
    onSocketCommentDeleted,
    onSocketUserTyping,
  };
})();
