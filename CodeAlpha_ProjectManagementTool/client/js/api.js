/**
 * CodeAlpha Boards — API Client
 */

const API = (() => {
  const BASE_URL = '/api';

  const getToken = () => localStorage.getItem('codealpha_token');
  const setToken = (token) => localStorage.setItem('codealpha_token', token);
  const removeToken = () => localStorage.removeItem('codealpha_token');

  const request = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    const token = getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          // Token invalid or expired
          removeToken();
          window.location.reload();
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  };

  return {
    getToken,
    setToken,
    removeToken,

    // Auth
    auth: {
      login: (email, password) =>
        request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      register: (name, email, password) =>
        request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        }),
      me: () => request('/auth/me'),
      searchUsers: (q) => request(`/auth/users/search?q=${encodeURIComponent(q)}`),
    },

    // Projects
    projects: {
      getAll: () => request('/projects'),
      getById: (id) => request(`/projects/${id}`),
      create: (data) =>
        request('/projects', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id, data) =>
        request(`/projects/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id) =>
        request(`/projects/${id}`, {
          method: 'DELETE',
        }),
      inviteMember: (id, email, role) =>
        request(`/projects/${id}/members`, {
          method: 'POST',
          body: JSON.stringify({ email, role }),
        }),
      removeMember: (id, userId) =>
        request(`/projects/${id}/members/${userId}`, {
          method: 'DELETE',
        }),
      addColumn: (id, name) =>
        request(`/projects/${id}/columns`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        }),
      updateColumn: (id, columnId, name) =>
        request(`/projects/${id}/columns/${columnId}`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        }),
      deleteColumn: (id, columnId) =>
        request(`/projects/${id}/columns/${columnId}`, {
          method: 'DELETE',
        }),
    },

    // Tasks
    tasks: {
      getAll: (projectId, params = {}) => {
        const query = new URLSearchParams({ projectId, ...params }).toString();
        return request(`/tasks?${query}`);
      },
      create: (data) =>
        request('/tasks', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id, data) =>
        request(`/tasks/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      move: (id, status, order) =>
        request(`/tasks/${id}/move`, {
          method: 'PUT',
          body: JSON.stringify({ status, order }),
        }),
      delete: (id) =>
        request(`/tasks/${id}`, {
          method: 'DELETE',
        }),
    },

    // Comments
    comments: {
      get: (taskId) => request(`/comments?taskId=${taskId}`),
      add: (taskId, text) =>
        request('/comments', {
          method: 'POST',
          body: JSON.stringify({ taskId, text }),
        }),
      delete: (id) =>
        request(`/comments/${id}`, {
          method: 'DELETE',
        }),
    },

    // Notifications
    notifications: {
      getAll: () => request('/notifications'),
      getUnreadCount: () => request('/notifications/unread-count'),
      markAsRead: (id) =>
        request(`/notifications/${id}/read`, {
          method: 'PUT',
        }),
      markAllAsRead: () =>
        request('/notifications/read-all', {
          method: 'PUT',
        }),
    },

    // Dashboard
    dashboard: {
      getData: () => request('/dashboard'),
    },
  };
})();
