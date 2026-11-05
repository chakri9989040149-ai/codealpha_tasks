// ==========================================================================
// CodeAlpha Store - Authentication Module
// ==========================================================================

const Auth = {
  user: null,

  init() {
    // Check saved user in localStorage
    const savedUser = localStorage.getItem('codealpha_user');
    if (savedUser) {
      try {
        this.user = JSON.parse(savedUser);
      } catch (e) {
        this.user = null;
      }
    }

    // Verify token with server if token exists
    if (API.getToken()) {
      this.checkSession();
    } else {
      this.updateUI();
    }

    this.bindEvents();
  },

  async checkSession() {
    try {
      const res = await API.get('/auth/me');
      if (res.success && res.user) {
        this.user = res.user;
        localStorage.setItem('codealpha_user', JSON.stringify(this.user));
      }
    } catch (err) {
      this.user = null;
      API.setToken(null);
      localStorage.removeItem('codealpha_user');
    } finally {
      this.updateUI();
    }
  },

  isAuthenticated() {
    return !!this.user && !!API.getToken();
  },

  isAdmin() {
    return this.isAuthenticated() && this.user.role === 'admin';
  },

  async login(email, password) {
    try {
      const res = await API.post('/auth/login', { email, password });
      if (res.success) {
        API.setToken(res.token);
        this.user = res.user;
        localStorage.setItem('codealpha_user', JSON.stringify(this.user));
        this.updateUI();

        // Dispatch auth change event
        window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: this.user } }));

        // Trigger cart sync
        if (window.Cart) {
          window.Cart.syncWithServer();
        }

        return res;
      }
    } catch (err) {
      throw err;
    }
  },

  async register(name, email, password, role = 'customer') {
    try {
      const res = await API.post('/auth/register', { name, email, password, role });
      if (res.success) {
        API.setToken(res.token);
        this.user = res.user;
        localStorage.setItem('codealpha_user', JSON.stringify(this.user));
        this.updateUI();

        window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: this.user } }));

        if (window.Cart) {
          window.Cart.syncWithServer();
        }

        return res;
      }
    } catch (err) {
      throw err;
    }
  },

  async logout() {
    try {
      await API.post('/auth/logout').catch(() => {});
    } finally {
      API.setToken(null);
      this.user = null;
      localStorage.removeItem('codealpha_user');
      this.updateUI();

      window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null } }));

      // Reset cart to empty
      if (window.Cart) {
        window.Cart.clearLocalCart();
      }

      window.App.showToast('You have been logged out.', 'info');
      // If on admin view, switch back to store
      if (window.App && window.App.currentView === 'admin') {
        window.App.switchView('store');
      }
    }
  },

  updateUI() {
    const authActions = document.getElementById('nav-auth-actions');
    const userMenu = document.getElementById('nav-user-menu');
    const adminLink = document.getElementById('nav-admin-link');
    const userNameEl = document.getElementById('dropdown-user-name');
    const userEmailEl = document.getElementById('dropdown-user-email');
    const userAvatarEl = document.getElementById('user-avatar-initials');

    if (this.isAuthenticated()) {
      if (authActions) authActions.classList.add('hidden');
      if (userMenu) userMenu.classList.remove('hidden');

      const name = this.user.name || 'User';
      if (userNameEl) userNameEl.textContent = name;
      if (userEmailEl) userEmailEl.textContent = this.user.email || '';
      if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();

      if (adminLink) {
        if (this.isAdmin()) {
          adminLink.classList.remove('hidden');
        } else {
          adminLink.classList.add('hidden');
        }
      }
    } else {
      if (authActions) authActions.classList.remove('hidden');
      if (userMenu) userMenu.classList.add('hidden');
      if (adminLink) adminLink.classList.add('hidden');
    }
  },

  bindEvents() {
    // User dropdown toggle
    const userTrigger = document.getElementById('user-dropdown-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');

    if (userTrigger && userDropdown) {
      userTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userTrigger.contains(e.target)) {
          userDropdown.classList.remove('show');
        }
      });
    }

    // Modal triggers
    const openAuthBtn = document.getElementById('open-auth-modal-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-modal-btn');

    if (openAuthBtn && authModal) {
      openAuthBtn.addEventListener('click', () => {
        this.openAuthModal('login');
      });
    }

    if (closeAuthBtn && authModal) {
      closeAuthBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
      });
    }

    // Tab switching inside auth modal
    const loginTabBtn = document.getElementById('tab-btn-login');
    const registerTabBtn = document.getElementById('tab-btn-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginTabBtn && registerTabBtn) {
      loginTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        document.getElementById('auth-error-banner').classList.add('hidden');
      });

      registerTabBtn.addEventListener('click', () => {
        registerTabBtn.classList.add('active');
        loginTabBtn.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        document.getElementById('auth-error-banner').classList.add('hidden');
      });
    }

    // Login Form Submit
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorBanner = document.getElementById('auth-error-banner');
        const submitBtn = document.getElementById('login-submit-btn');

        errorBanner.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
          await this.login(email, password);
          authModal.classList.remove('active');
          window.App.showToast(`Welcome back, ${this.user.name}!`, 'success');
        } catch (err) {
          errorBanner.textContent = err.message || 'Login failed. Please check your credentials.';
          errorBanner.classList.remove('hidden');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      });
    }

    // Register Form Submit
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const role = document.getElementById('reg-role')?.value || 'customer';
        const errorBanner = document.getElementById('auth-error-banner');
        const submitBtn = document.getElementById('register-submit-btn');

        errorBanner.classList.add('hidden');

        if (password.length < 6) {
          errorBanner.textContent = 'Password must be at least 6 characters.';
          errorBanner.classList.remove('hidden');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        try {
          await this.register(name, email, password, role);
          authModal.classList.remove('active');
          window.App.showToast(`Account created! Welcome, ${this.user.name}.`, 'success');
        } catch (err) {
          errorBanner.textContent = err.message || 'Registration failed.';
          errorBanner.classList.remove('hidden');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
        }
      });
    }

    // Demo Fill Buttons for instant testing
    const fillAdminBtn = document.getElementById('demo-fill-admin');
    const fillCustomerBtn = document.getElementById('demo-fill-customer');

    if (fillAdminBtn) {
      fillAdminBtn.addEventListener('click', () => {
        if (loginTabBtn) loginTabBtn.click();
        document.getElementById('login-email').value = 'admin@codealpha.com';
        document.getElementById('login-password').value = 'Admin@123456';
      });
    }

    if (fillCustomerBtn) {
      fillCustomerBtn.addEventListener('click', () => {
        if (loginTabBtn) loginTabBtn.click();
        document.getElementById('login-email').value = 'customer@codealpha.com';
        document.getElementById('login-password').value = 'Customer@123456';
      });
    }

    // Logout trigger
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }

    // Listen to expired token event
    window.addEventListener('auth:expired', () => {
      this.updateUI();
      window.App.showToast('Your session has expired. Please log in again.', 'warning');
    });
  },

  openAuthModal(tab = 'login') {
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;

    authModal.classList.add('active');
    const errorBanner = document.getElementById('auth-error-banner');
    if (errorBanner) errorBanner.classList.add('hidden');

    if (tab === 'login') {
      document.getElementById('tab-btn-login')?.click();
    } else {
      document.getElementById('tab-btn-register')?.click();
    }
  }
};

window.Auth = Auth;
