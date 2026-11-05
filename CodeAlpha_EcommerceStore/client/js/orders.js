// ==========================================================================
// CodeAlpha Store - Orders History Module
// ==========================================================================

const Orders = {
  orders: [],

  async init() {
    this.bindEvents();
  },

  async loadMyOrders() {
    const listEl = document.getElementById('my-orders-list');
    const emptyEl = document.getElementById('orders-empty-state');

    if (!Auth.isAuthenticated()) {
      if (listEl) listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        document.getElementById('orders-empty-desc').textContent = 'Please log in to view your order history.';
      }
      return;
    }

    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="payment-spinner" style="width: 2.5rem; height: 2.5rem;"></div>
          <p>Fetching your orders...</p>
        </div>
      `;
    }

    try {
      const res = await API.get('/orders/myorders');
      if (res.success) {
        this.orders = res.orders || [];
        this.renderOrders();
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      if (listEl) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3 class="empty-state-title">Failed to load orders</h3>
            <p class="empty-state-desc">${err.message || 'Please try again.'}</p>
          </div>
        `;
      }
    }
  },

  renderOrders() {
    const listEl = document.getElementById('my-orders-list');
    const emptyEl = document.getElementById('orders-empty-state');
    if (!listEl) return;

    if (this.orders.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        document.getElementById('orders-empty-desc').textContent = "You haven't placed any orders yet. Discover our catalog!";
      }
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    listEl.innerHTML = this.orders
      .map((order) => {
        const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        let statusBadgeClass = 'badge-primary';
        if (order.status === 'Delivered') statusBadgeClass = 'badge-success';
        if (order.status === 'Processing') statusBadgeClass = 'badge-warning';
        if (order.status === 'Cancelled') statusBadgeClass = 'badge-danger';

        const itemsThumbnails = order.items
          .map(
            (item) => `
            <img 
              src="${item.image}" 
              alt="${item.title}" 
              class="order-preview-img" 
              title="${item.qty}x ${item.title}"
              onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'"
            />
          `
          )
          .join('');

        return `
          <div class="order-card">
            <div class="order-card-header">
              <div>
                <div class="order-meta-title">Order #${order._id.substring(order._id.length - 8).toUpperCase()}</div>
                <div class="order-meta-sub">Placed on ${dateStr}</div>
              </div>
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <span class="badge ${statusBadgeClass}">${order.status}</span>
                <span style="font-size:1.25rem; font-weight:800; color:#fff;">$${order.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div style="margin-bottom:0.75rem; font-size:0.85rem; color:var(--text-secondary);">
              Items (${order.items.reduce((s, i) => s + i.qty, 0)}):
            </div>
            <div class="order-items-preview">
              ${itemsThumbnails}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; border-top:1px solid var(--border-color); padding-top:0.75rem;">
              <div style="font-size:0.85rem; color:var(--text-muted);">
                Ship to: <strong style="color:var(--text-primary);">${order.shippingAddress.fullName}</strong> (${order.shippingAddress.city}, ${order.shippingAddress.country})
              </div>
              <button 
                class="btn btn-secondary btn-sm" 
                onclick="Orders.viewReceipt('${order._id}')"
              >
                View Full Receipt
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  },

  async viewReceipt(orderId) {
    const order = this.orders.find((o) => o._id === orderId);
    if (!order) return;

    const modal = document.getElementById('order-receipt-modal');
    if (!modal) return;

    document.getElementById('receipt-order-id').textContent = order._id;
    document.getElementById('receipt-date').textContent = new Date(order.createdAt).toLocaleString();
    document.getElementById('receipt-status').textContent = order.status;
    document.getElementById('receipt-txn').textContent = order.paymentResult?.transactionId || 'N/A';
    document.getElementById('receipt-customer').textContent = `${order.shippingAddress.fullName} (${order.shippingAddress.phone || 'N/A'})`;
    document.getElementById('receipt-address').textContent = `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}, ${order.shippingAddress.country}`;

    const itemsContainer = document.getElementById('receipt-items-container');
    if (itemsContainer) {
      itemsContainer.innerHTML = order.items
        .map(
          (item) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <img src="${item.image}" alt="" style="width:36px; height:36px; border-radius:4px; object-fit:cover;" />
              <div>
                <div style="font-size:0.875rem; font-weight:600;">${item.title}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">$${item.price.toFixed(2)} x ${item.qty}</div>
              </div>
            </div>
            <div style="font-weight:700; font-size:0.9rem;">$${(item.price * item.qty).toFixed(2)}</div>
          </div>
        `
        )
        .join('');
    }

    document.getElementById('receipt-subtotal').textContent = `$${order.subtotal.toFixed(2)}`;
    document.getElementById('receipt-shipping').textContent = order.shippingPrice === 0 ? 'FREE' : `$${order.shippingPrice.toFixed(2)}`;
    document.getElementById('receipt-tax').textContent = `$${order.taxPrice.toFixed(2)}`;
    document.getElementById('receipt-total').textContent = `$${order.totalPrice.toFixed(2)}`;

    modal.classList.add('active');
  },

  bindEvents() {
    document.getElementById('close-receipt-modal-btn')?.addEventListener('click', () => {
      document.getElementById('order-receipt-modal')?.classList.remove('active');
    });

    document.getElementById('orders-empty-shop-btn')?.addEventListener('click', () => {
      window.App.switchView('store');
    });
  }
};

window.Orders = Orders;
