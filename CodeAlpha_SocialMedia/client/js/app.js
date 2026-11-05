// CodeAlpha Social - Main Application Controller & Router

const App = {
  async init() {
    Toast.init();
    Posts.init();
    Profile.init();
    Explore.init();

    // Check auth on load
    await Auth.init();

    // Check system status
    this.checkSystemStatus();

    // Setup router
    window.addEventListener('hashchange', () => this.handleRouting());
    this.handleRouting();

    // Auth state change handler
    Auth.onChange((user) => {
      // Refresh current view on login/logout
      this.handleRouting();
      Explore.loadSuggestedUsers();
    });

    // Brand logo returns to home
    const brandBtn = document.getElementById('btn-brand-home');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        window.location.hash = '#home';
      });
    }
  },

  async checkSystemStatus() {
    try {
      const res = await API.get('/status');
      if (res.success) {
        const textEl = document.getElementById('api-status-text');
        if (textEl && res.database) {
          textEl.textContent = res.database.mode;
        }
      }
    } catch (err) {
      const textEl = document.getElementById('api-status-text');
      if (textEl) textEl.textContent = 'Offline';
    }
  },

  handleRouting() {
    const hash = window.location.hash || '#home';
    const [route, param] = hash.slice(1).split('/');

    // Update active nav links
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-link').forEach((link) => link.classList.remove('active'));

    const viewHome = document.getElementById('view-home');
    const viewExplore = document.getElementById('view-explore');
    const viewProfile = document.getElementById('view-profile');
    const headerTitle = document.getElementById('page-header-title');

    // Hide all views first
    if (viewHome) viewHome.style.display = 'none';
    if (viewExplore) viewExplore.style.display = 'none';
    if (viewProfile) viewProfile.style.display = 'none';

    if (route === 'home' || route === '') {
      if (viewHome) viewHome.style.display = 'block';
      if (headerTitle) headerTitle.textContent = 'Home';
      document.getElementById('nav-item-home')?.classList.add('active');
      document.getElementById('mob-nav-home')?.classList.add('active');

      Posts.loadHomeFeed(1);
    } else if (route === 'explore') {
      if (viewExplore) viewExplore.style.display = 'block';
      if (headerTitle) headerTitle.textContent = 'Explore';
      document.getElementById('nav-item-explore')?.classList.add('active');
      document.getElementById('mob-nav-explore')?.classList.add('active');

      const exploreInput = document.getElementById('explore-search-input');
      const query = exploreInput ? exploreInput.value.trim() : '';
      Explore.executeSearch(query);
    } else if (route === 'profile') {
      if (viewProfile) viewProfile.style.display = 'block';
      document.getElementById('nav-item-profile')?.classList.add('active');
      document.getElementById('mob-nav-profile')?.classList.add('active');

      let targetUsername = param;
      if (!targetUsername && Auth.user) {
        targetUsername = Auth.user.username;
      }

      if (targetUsername) {
        if (headerTitle) headerTitle.textContent = `@${targetUsername}`;
        Profile.loadProfile(targetUsername);
      } else {
        // Not logged in and no username specified
        Auth.openModal('login');
        window.location.hash = '#home';
      }
    } else if (route === 'post' && param) {
      // Direct post view
      if (viewHome) viewHome.style.display = 'block';
      Comments.openModal(param);
    }
  },
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
