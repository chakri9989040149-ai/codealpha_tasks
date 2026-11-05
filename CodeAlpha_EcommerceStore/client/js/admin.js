// ==========================================================================
// CodeAlpha Store - Admin Area Management Module
// ==========================================================================

const Admin = {
  currentTab: 'products',
  products: [],
  orders: [],
  editingProductId: null,

  async init() {
    this.bindEvents();
  },

  async loadDashboard() {
    if (!Auth.isAdmin()) {
      window.App.showToast('Access denied: Admin privileges required.', 'error');
      window.App.switchView('store');
      return;
    }

    await Promise.all([this.loadSummary(), this.loadProducts(), this.loadOrders()]);
  },

  async loadSummary() {
    try {
      const res = await API.get('/orders/admin/summary');
      if (res.success && res.summary) {
        const s = res.summary;
        document.getElementById('metric-revenue').textContent = `$${s.totalRevenue.toFixed(2)}`;
        document.getElementById('metric-orders').textContent = s.totalOrders;
        document.getElementById('metric-products').textContent = s.totalProducts;
        document.getElementById('metric-low-stock').textContent = s.lowStockProducts;
      }
    } catch (err) {
      console.error('Error loading admin summary:', err);
    }
  },

  async loadProducts() {
    const tbody = document.getElementById('admin-products-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:2rem;">Loading products...</td></tr>`;
    }

    try {
      const res = await API.get('/products?limit=100');
      if (res.success) {
        this.products = res.products || [];
        this.renderProductsTable();
      }
    } catch (err) {
      console.error('Error loading admin products:', err);
    }
  },

  renderProductsTable() {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;

    if (this.products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:2rem;">No products found. Add your first product!</td></tr>`;
      return;
    }

    tbody.innerHTML = this.products
      .map((p) => {
        const isOutOfStock = p.stock <= 0;
        const isLow = p.stock > 0 && p.stock <= 5;
        const stockBadge = isOutOfStock
          ? '<span class="badge badge-danger">0 Out</span>'
          : isLow
          ? `<span class="badge badge-warning">${p.stock} Low</span>`
          : `<span class="badge badge-success">${p.stock}</span>`;

        return `
          <tr>
            <td>
              <div class="table-product-cell">
                <img src="${p.image}" alt="" class="table-thumb" onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'" />
                <div>
                  <div style="font-weight:600; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${p.title}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${p._id.substring(p._id.length - 6)}</div>
                </div>
              </div>
            </td>
            <td><span class="badge badge-secondary">${p.category}</span></td>
            <td style="font-weight:700;">$${p.price.toFixed(2)}</td>
            <td>${stockBadge}</td>
            <td>★ ${p.rating ? p.rating.toFixed(1) : '4.5'}</td>
            <td>
              <div class="table-actions">
                <button 
                  class="btn btn-secondary btn-sm" 
                  onclick="Admin.openEditProductModal('${p._id}')"
                  title="Edit Product"
                >
                  Edit
                </button>
                <button 
                  class="btn btn-danger btn-sm" 
                  onclick="Admin.deleteProduct('${p._id}', '${p.title.replace(/'/g, "\\'")}')"
                  title="Delete Product"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  async loadOrders() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:2rem;">Loading orders...</td></tr>`;
    }

    try {
      const res = await API.get('/orders');
      if (res.success) {
        this.orders = res.orders || [];
        this.renderOrdersTable();
      }
    } catch (err) {
      console.error('Error loading admin orders:', err);
    }
  },

  renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:2rem;">No orders placed yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.orders
      .map((o) => {
        const customerName = o.user?.name || o.shippingAddress?.fullName || 'Customer';
        const customerEmail = o.user?.email || 'N/A';
        const dateStr = new Date(o.createdAt).toLocaleDateString();

        return `
          <tr>
            <td style="font-family:monospace; font-weight:700;">#${o._id.substring(o._id.length - 8).toUpperCase()}</td>
            <td>
              <div style="font-weight:600;">${customerName}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${customerEmail}</div>
            </td>
            <td>${dateStr}</td>
            <td>${o.items?.length || 0} items</td>
            <td style="font-weight:700; color:#fff;">$${o.totalPrice.toFixed(2)}</td>
            <td>
              <select 
                class="status-select" 
                onchange="Admin.updateOrderStatus('${o._id}', this.value)"
              >
                <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </td>
          </tr>
        `;
      })
      .join('');
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      const res = await API.put(`/orders/${orderId}/status`, { status: newStatus });
      if (res.success) {
        window.App.showToast(`Order status updated to ${newStatus}`, 'success');
        this.loadSummary();
      }
    } catch (err) {
      window.App.showToast(err.message || 'Failed to update order status', 'error');
      this.loadOrders();
    }
  },

  openAddProductModal() {
    this.editingProductId = null;
    const modal = document.getElementById('admin-product-modal');
    const form = document.getElementById('admin-product-form');
    const titleEl = document.getElementById('admin-product-modal-title');
    const previewImg = document.getElementById('admin-img-preview');

    if (form) form.reset();
    if (titleEl) titleEl.textContent = 'Add New Product';
    if (previewImg) previewImg.style.display = 'none';

    if (modal) modal.classList.add('active');
  },

  openEditProductModal(productId) {
    const product = this.products.find((p) => p._id === productId);
    if (!product) return;

    this.editingProductId = productId;
    const modal = document.getElementById('admin-product-modal');
    const titleEl = document.getElementById('admin-product-modal-title');

    if (titleEl) titleEl.textContent = 'Edit Product';

    document.getElementById('admin-prod-title').value = product.title;
    document.getElementById('admin-prod-category').value = product.category;
    document.getElementById('admin-prod-price').value = product.price;
    document.getElementById('admin-prod-stock').value = product.stock;
    document.getElementById('admin-prod-image').value = product.image;
    document.getElementById('admin-prod-desc').value = product.description;
    document.getElementById('admin-prod-featured').checked = !!product.isFeatured;

    const previewImg = document.getElementById('admin-img-preview');
    if (previewImg) {
      previewImg.src = product.image;
      previewImg.style.display = 'block';
    }

    if (modal) modal.classList.add('active');
  },

  async saveProduct(formData) {
    try {
      if (this.editingProductId) {
        // Update
        const res = await API.put(`/products/${this.editingProductId}`, formData);
        if (res.success) {
          window.App.showToast('Product updated successfully!', 'success');
        }
      } else {
        // Create
        const res = await API.post('/products', formData);
        if (res.success) {
          window.App.showToast('New product created successfully!', 'success');
        }
      }

      document.getElementById('admin-product-modal')?.classList.remove('active');
      await this.loadProducts();
      await this.loadSummary();
      Store.fetchProducts(); // Refresh storefront catalog
    } catch (err) {
      window.App.showToast(err.message || 'Failed to save product', 'error');
    }
  },

  async deleteProduct(productId, productTitle) {
    if (!confirm(`Are you sure you want to delete "${productTitle}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await API.delete(`/products/${productId}`);
      if (res.success) {
        window.App.showToast(`"${productTitle}" was deleted.`, 'info');
        await this.loadProducts();
        await this.loadSummary();
        Store.fetchProducts();
      }
    } catch (err) {
      window.App.showToast(err.message || 'Failed to delete product', 'error');
    }
  },

  bindEvents() {
    // Tab switching in Admin
    const tabProducts = document.getElementById('admin-tab-products-btn');
    const tabOrders = document.getElementById('admin-tab-orders-btn');
    const viewProducts = document.getElementById('admin-products-view');
    const viewOrders = document.getElementById('admin-orders-view');

    if (tabProducts && tabOrders) {
      tabProducts.addEventListener('click', () => {
        tabProducts.classList.add('active');
        tabOrders.classList.remove('active');
        viewProducts.classList.remove('hidden');
        viewOrders.classList.add('hidden');
        this.currentTab = 'products';
      });

      tabOrders.addEventListener('click', () => {
        tabOrders.classList.add('active');
        tabProducts.classList.remove('active');
        viewOrders.classList.remove('hidden');
        viewProducts.classList.add('hidden');
        this.currentTab = 'orders';
        this.loadOrders();
      });
    }

    // Add Product Modal trigger
    document.getElementById('admin-add-product-btn')?.addEventListener('click', () => {
      this.openAddProductModal();
    });

    document.getElementById('close-admin-product-modal-btn')?.addEventListener('click', () => {
      document.getElementById('admin-product-modal')?.classList.remove('active');
    });

    // Live preview for image URL input
    const imgInput = document.getElementById('admin-prod-image');
    const previewImg = document.getElementById('admin-img-preview');
    if (imgInput && previewImg) {
      imgInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
          previewImg.src = val;
          previewImg.style.display = 'block';
        } else {
          previewImg.style.display = 'none';
        }
      });
    }

    // Product Form Submit
    const productForm = document.getElementById('admin-product-form');
    if (productForm) {
      productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
          title: document.getElementById('admin-prod-title').value.trim(),
          category: document.getElementById('admin-prod-category').value.trim(),
          price: parseFloat(document.getElementById('admin-prod-price').value),
          stock: parseInt(document.getElementById('admin-prod-stock').value, 10),
          image: document.getElementById('admin-prod-image').value.trim(),
          description: document.getElementById('admin-prod-desc').value.trim(),
          isFeatured: document.getElementById('admin-prod-featured').checked
        };
        this.saveProduct(data);
      });
    }
  }
};

window.Admin = Admin;
