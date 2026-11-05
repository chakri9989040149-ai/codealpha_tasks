// CodeAlpha Social - Auth Management & User State

const Auth = {
  user: null,
  listeners: [],

  onChange(callback) {
    this.listeners.push(callback);
  },

  notify() {
    this.listeners.forEach((cb) => cb(this.user));
    this.updateUI();
  },

  isAuthenticated() {
    return !!this.user;
  },

  async init() {
    const token = API.getToken();
    if (!token) {
      this.user = null;
      this.notify();
      return;
    }

    try {
      const data = await API.get('/auth/me');
      if (data && data.success && data.user) {
        this.user = data.user;
      } else {
        this.logout(false);
      }
    } catch (err) {
      console.warn('Auth token expired or invalid:', err.message);
      this.logout(false);
    }
    this.notify();
  },

  async login(identifier, password) {
    try {
      const data = await API.post('/auth/login', { identifier, password });
      if (data.success && data.token) {
        API.setToken(data.token);
        this.user = data.user;
        this.notify();
        Toast.success(`Welcome back, @${data.user.username}!`);
        this.closeModal();
        return data.user;
      }
    } catch (err) {
      Toast.error(err.message || 'Login failed. Please check your credentials.');
      throw err;
    }
  },

  async register(formData) {
    try {
      const data = await API.post('/auth/register', formData);
      if (data.success && data.token) {
        API.setToken(data.token);
        this.user = data.user;
        this.notify();
        Toast.success('Account created successfully! Welcome to CodeAlpha Social.');
        this.closeModal();
        return data.user;
      }
    } catch (err) {
      Toast.error(err.message || 'Registration failed.');
      throw err;
    }
  },

  logout(showToast = true) {
    API.setToken(null);
    this.user = null;
    this.notify();
    if (showToast) {
      Toast.info('You have logged out.');
    }
  },

  async quickLogin(username) {
    return this.login(username, 'Password123!');
  },

  openModal(tab = 'login') {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    modal.classList.add('open');
    this.switchTab(tab);
  },

  closeModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.remove('open');
  },

  switchTab(tab) {
    const tabLogin = document.getElementById('btn-auth-tab-login');
    const tabReg = document.getElementById('btn-auth-tab-register');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
      formLogin.style.display = 'block';
      formReg.style.display = 'none';
    } else {
      tabReg.classList.add('active');
      tabLogin.classList.remove('active');
      formReg.style.display = 'block';
      formLogin.style.display = 'none';
    }
  },

  updateUI() {
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarHandle = document.getElementById('sidebar-user-handle');
    const composerAvatar = document.getElementById('composer-user-avatar');
    const topSignInBtn = document.getElementById('btn-top-signin');

    if (this.user) {
      const avatarSrc = this.user.avatar || '/uploads/default-avatar.svg';
      if (sidebarAvatar) sidebarAvatar.src = avatarSrc;
      if (sidebarName) sidebarName.textContent = this.user.username;
      if (sidebarHandle) sidebarHandle.textContent = `@${this.user.username}`;
      if (composerAvatar) composerAvatar.src = avatarSrc;
      if (topSignInBtn) topSignInBtn.style.display = 'none';
    } else {
      if (sidebarAvatar) sidebarAvatar.src = '/uploads/default-avatar.svg';
      if (sidebarName) sidebarName.textContent = 'Guest User';
      if (sidebarHandle) sidebarHandle.textContent = 'Click to sign in';
      if (composerAvatar) composerAvatar.src = '/uploads/default-avatar.svg';
      if (topSignInBtn) topSignInBtn.style.display = 'inline-block';
    }
  },
};

// Bind Auth UI Events
document.addEventListener('DOMContentLoaded', () => {
  const topSignInBtn = document.getElementById('btn-top-signin');
  if (topSignInBtn) {
    topSignInBtn.addEventListener('click', () => Auth.openModal('login'));
  }

  // Tab Switchers
  const tabLogin = document.getElementById('btn-auth-tab-login');
  const tabReg = document.getElementById('btn-auth-tab-register');
  const closeBtn = document.getElementById('btn-close-auth-modal');
  const userContainer = document.getElementById('sidebar-user-container');

  if (tabLogin) tabLogin.addEventListener('click', () => Auth.switchTab('login'));
  if (tabReg) tabReg.addEventListener('click', () => Auth.switchTab('register'));
  if (closeBtn) closeBtn.addEventListener('click', () => Auth.closeModal());

  // Click on user card in sidebar: if not logged in -> open modal; if logged in -> go to profile or show options
  if (userContainer) {
    userContainer.addEventListener('click', (e) => {
      // If clicking the logout button specifically
      if (e.target.closest('#btn-sidebar-auth')) {
        if (Auth.isAuthenticated()) {
          Auth.logout();
        } else {
          Auth.openModal('login');
        }
        return;
      }
      if (Auth.isAuthenticated()) {
        window.location.hash = `#profile/${Auth.user.username}`;
      } else {
        Auth.openModal('login');
      }
    });
  }

  // Handle Login Form Submit
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('login-identifier').value.trim();
      const password = document.getElementById('login-password').value;
      if (!identifier || !password) return;

      const submitBtn = document.getElementById('btn-submit-login');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        await Auth.login(identifier, password);
        formLogin.reset();
      } catch (err) {
        // Handled by Auth.login Toast
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to CodeAlpha';
      }
    });
  }

  // Handle Register Form Submit
  const formReg = document.getElementById('form-register');
  if (formReg) {
    formReg.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const bio = document.getElementById('register-bio').value.trim();

      const submitBtn = document.getElementById('btn-submit-register');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        await Auth.register({ username, email, password, bio });
        formReg.reset();
      } catch (err) {
        // Handled by Auth.register Toast
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  }

  // Demo user quick login buttons
  document.querySelectorAll('.btn-demo-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const username = btn.dataset.user;
      btn.textContent = 'Logging in...';
      try {
        await Auth.quickLogin(username);
      } finally {
        btn.textContent = `👤 ${username}`;
      }
    });
  });
});
