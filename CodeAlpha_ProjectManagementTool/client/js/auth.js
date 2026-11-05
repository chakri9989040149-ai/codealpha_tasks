/**
 * CodeAlpha Boards — Authentication Controller
 */

const Auth = (() => {
  let currentUser = null;

  const init = () => {
    setupEventListeners();
  };

  const setupEventListeners = () => {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const btnLogout = document.getElementById('btnLogout');

    // Switch between Sign In and Register tabs
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await API.auth.login(email, password);
        if (res.token) {
          handleAuthSuccess(res.token, res.user);
        }
      } catch (err) {
        App.showToast('Login Failed', err.message, 'danger');
      }
    });

    // Register Form Submit
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;

      try {
        const res = await API.auth.register(name, email, password);
        if (res.token) {
          handleAuthSuccess(res.token, res.user);
        }
      } catch (err) {
        App.showToast('Registration Failed', err.message, 'danger');
      }
    });

    // Quick Demo Sign-in buttons
    document.querySelectorAll('.demo-btn, .demo-switch-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const email = btn.getAttribute('data-email');
        const pass = btn.getAttribute('data-pass');
        try {
          const res = await API.auth.login(email, pass);
          if (res.token) {
            handleAuthSuccess(res.token, res.user);
          }
        } catch (err) {
          App.showToast('Demo Sign-In Failed', err.message, 'danger');
        }
      });
    });

    // Logout
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        logout();
      });
    }
  };

  const handleAuthSuccess = (token, user) => {
    API.setToken(token);
    currentUser = user;
    App.showToast('Welcome Back!', `Signed in as ${user.name}`, 'success');
    App.onAuthenticated(user, token);
  };

  const checkAuth = async () => {
    const token = API.getToken();
    if (!token) {
      showAuthScreen();
      return null;
    }

    try {
      const res = await API.auth.me();
      currentUser = res.user;
      App.onAuthenticated(currentUser, token);
      return currentUser;
    } catch (err) {
      console.warn('Authentication token invalid or expired:', err);
      API.removeToken();
      showAuthScreen();
      return null;
    }
  };

  const showAuthScreen = () => {
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('appView').classList.add('hidden');
    AppSocket.disconnect();
  };

  const logout = () => {
    API.removeToken();
    currentUser = null;
    AppSocket.disconnect();
    window.location.reload();
  };

  const getUser = () => currentUser;

  return {
    init,
    checkAuth,
    getUser,
    logout,
  };
})();
