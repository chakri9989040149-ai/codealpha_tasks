// ==========================================================================
// CodeAlpha Store - App Main Orchestrator & View Switcher
// ==========================================================================

const App = {
  currentView: 'store', // 'store' | 'orders' | 'admin'

  init() {
    this.bindGlobalNavigation();

    // Initialize subsystems in order
    Auth.init();
    Store.init();
    Cart.init();
    Checkout.init();
    Orders.init();
    Admin.init();

    // Handle deep links or browser navigation
    this.handleRoute();
    window.addEventListener('popstate', () => this.handleRoute());
  },

  switchView(viewName, updateHistory = true) {
    this.currentView = viewName;

    const storeView = document.getElementById('view-store');
    const ordersView = document.getElementById('view-orders');
    const adminView = document.getElementById('view-admin');

    const navStoreLink = document.getElementById('nav-store-link');
    const navOrdersLink = document.getElementById('nav-orders-link');
    const navAdminLink = document.getElementById('nav-admin-link');

    // Hide all
    if (storeView) storeView.classList.add('hidden');
    if (ordersView) ordersView.classList.add('hidden');
    if (adminView) adminView.classList.add('hidden');

    if (navStoreLink) navStoreLink.classList.remove('active');
    if (navOrdersLink) navOrdersLink.classList.remove('active');
    if (navAdminLink) navAdminLink.classList.remove('active');

    if (viewName === 'store') {
      if (storeView) storeView.classList.remove('hidden');
      if (navStoreLink) navStoreLink.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'orders') {
      if (ordersView) ordersView.classList.remove('hidden');
      if (navOrdersLink) navOrdersLink.classList.add('active');
      Orders.loadMyOrders();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'admin') {
      if (adminView) adminView.classList.remove('hidden');
      if (navAdminLink) navAdminLink.classList.add('active');
      Admin.loadDashboard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (updateHistory) {
      const hash = viewName === 'store' ? '' : `#${viewName}`;
      history.pushState({ view: viewName }, '', window.location.pathname + hash);
    }
  },

  handleRoute() {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'orders') {
      this.switchView('orders', false);
    } else if (hash === 'admin') {
      this.switchView('admin', false);
    } else {
      this.switchView('store', false);
    }
  },

  bindGlobalNavigation() {
    // Nav Brand click goes to store
    document.getElementById('nav-brand-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('store');
    });

    // Nav Store Link
    document.getElementById('nav-store-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('store');
    });

    // Nav Orders Link
    document.getElementById('nav-orders-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('orders');
    });

    // Nav Admin Link
    document.getElementById('nav-admin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('admin');
    });

    // Dropdown Order history link
    document.getElementById('dropdown-orders-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown-menu')?.classList.remove('show');
      this.switchView('orders');
    });

    // Dropdown Admin link
    document.getElementById('dropdown-admin-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('user-dropdown-menu')?.classList.remove('show');
      this.switchView('admin');
    });
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icon}</span>
        <span>${message}</span>
      </div>
      <button class="toast-close" title="Close">✕</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 250);
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);

    container.appendChild(toast);
  }
};

window.App = App;

// Bootstrap on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
