// ==========================================================================
// CodeAlpha Store - Product Catalog & Storefront Module
// ==========================================================================

const Store = {
  products: [],
  categories: [],
  currentCategory: 'All',
  searchQuery: '',
  currentSort: 'newest',
  selectedProduct: null,
  modalQty: 1,

  async init() {
    this.bindEvents();
    await this.fetchProducts();
  },

  async fetchProducts() {
    const gridEl = document.getElementById('products-grid');
    const countEl = document.getElementById('results-count-number');
    
    if (gridEl) {
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="payment-spinner" style="width: 2.5rem; height: 2.5rem;"></div>
          <p>Loading catalog items...</p>
        </div>
      `;
    }

    try {
      const params = {
        sort: this.currentSort
      };

      if (this.currentCategory && this.currentCategory !== 'All') {
        params.category = this.currentCategory;
      }

      if (this.searchQuery && this.searchQuery.trim() !== '') {
        params.search = this.searchQuery.trim();
      }

      const res = await API.get('/products', params);

      if (res.success) {
        this.products = res.products || [];
        this.categories = res.categories || [];
        
        if (countEl) {
          countEl.textContent = res.total;
        }

        this.renderCategories();
        this.renderProducts();
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      if (gridEl) {
        gridEl.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">⚠️</div>
            <h3 class="empty-state-title">Error Loading Catalog</h3>
            <p class="empty-state-desc">${err.message || 'Could not connect to the product database.'}</p>
            <button class="btn btn-primary" onclick="Store.fetchProducts()">Retry</button>
          </div>
        `;
      }
    }
  },

  renderCategories() {
    const container = document.getElementById('filter-categories-container');
    if (!container) return;

    // Standard categories list
    const allCategories = ['All', 'Electronics', 'Fashion', 'Home & Living', 'Fitness & Outdoors'];
    
    // Merge any distinct ones from server
    this.categories.forEach((cat) => {
      if (!allCategories.includes(cat)) {
        allCategories.push(cat);
      }
    });

    container.innerHTML = allCategories
      .map(
        (cat) => `
        <button 
          class="category-chip ${this.currentCategory === cat ? 'active' : ''}" 
          data-category="${cat}"
        >
          ${cat}
        </button>
      `
      )
      .join('');

    // Attach click handlers
    container.querySelectorAll('.category-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category');
        this.setCategory(cat);
      });
    });
  },

  setCategory(cat) {
    this.currentCategory = cat;
    this.renderCategories();
    this.fetchProducts();
  },

  renderProducts() {
    const gridEl = document.getElementById('products-grid');
    if (!gridEl) return;

    if (this.products.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">No products found</h3>
          <p class="empty-state-desc">We couldn't find any products matching "${this.searchQuery || this.currentCategory}". Try adjusting your filters.</p>
          <button class="btn btn-secondary" onclick="Store.resetFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = this.products
      .map((product) => {
        const isOutOfStock = product.stock <= 0;
        const isLowStock = product.stock > 0 && product.stock <= 5;

        let stockBadgeHtml = '';
        if (isOutOfStock) {
          stockBadgeHtml = '<span class="badge badge-danger">Out of Stock</span>';
        } else if (isLowStock) {
          stockBadgeHtml = `<span class="badge badge-warning">Only ${product.stock} Left</span>`;
        } else if (product.isFeatured) {
          stockBadgeHtml = '<span class="badge badge-primary">Featured</span>';
        }

        const stockText = isOutOfStock
          ? '<span class="stock-indicator stock-out">Out of Stock</span>'
          : isLowStock
          ? `<span class="stock-indicator stock-low">Only ${product.stock} left</span>`
          : '<span class="stock-indicator stock-in">In Stock</span>';

        return `
          <div class="product-card" data-id="${product._id}">
            <div class="product-card-image-wrap" onclick="Store.openProductModal('${product._id}')">
              <img 
                src="${product.image}" 
                alt="${product.title}" 
                class="product-card-image"
                loading="lazy"
                onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'"
              />
              <div class="product-badges">
                ${stockBadgeHtml}
              </div>
            </div>
            <div class="product-card-body">
              <span class="product-category-meta">${product.category}</span>
              <h3 class="product-title" onclick="Store.openProductModal('${product._id}')" title="${product.title}">
                ${product.title}
              </h3>
              <div class="product-rating">
                <span>★</span>
                <span>${product.rating ? product.rating.toFixed(1) : '4.8'}</span>
                <span class="rating-count">(${product.numReviews || 24})</span>
              </div>
              <div class="product-footer">
                <div class="product-price-box">
                  <span class="product-price">$${product.price.toFixed(2)}</span>
                  ${stockText}
                </div>
                <button 
                  class="btn btn-primary btn-sm" 
                  ${isOutOfStock ? 'disabled' : ''}
                  onclick="Cart.addItem('${product._id}', 1, event)"
                  title="${isOutOfStock ? 'Out of stock' : 'Quick Add to Cart'}"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  ${isOutOfStock ? 'Sold Out' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  },

  resetFilters() {
    this.currentCategory = 'All';
    this.searchQuery = '';
    const searchInput = document.getElementById('nav-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    this.renderCategories();
    this.fetchProducts();
  },

  async openProductModal(productId) {
    try {
      const res = await API.get(`/products/${productId}`);
      if (!res.success || !res.product) return;

      const p = res.product;
      this.selectedProduct = p;
      this.modalQty = 1;

      const modal = document.getElementById('product-details-modal');
      const imgEl = document.getElementById('detail-modal-img');
      const categoryEl = document.getElementById('detail-modal-category');
      const titleEl = document.getElementById('detail-modal-title');
      const ratingEl = document.getElementById('detail-modal-rating');
      const priceEl = document.getElementById('detail-modal-price');
      const stockEl = document.getElementById('detail-modal-stock');
      const descEl = document.getElementById('detail-modal-desc');
      const qtyInput = document.getElementById('detail-modal-qty-input');
      const addBtn = document.getElementById('detail-modal-add-btn');

      if (imgEl) imgEl.src = p.image;
      if (categoryEl) categoryEl.textContent = p.category;
      if (titleEl) titleEl.textContent = p.title;
      if (ratingEl) {
        ratingEl.innerHTML = `★ ${p.rating ? p.rating.toFixed(1) : '4.8'} <span class="rating-count">(${p.numReviews || 32} reviews)</span>`;
      }
      if (priceEl) priceEl.textContent = `$${p.price.toFixed(2)}`;
      if (descEl) descEl.textContent = p.description;

      const isOutOfStock = p.stock <= 0;
      if (stockEl) {
        stockEl.innerHTML = isOutOfStock
          ? '<span class="badge badge-danger">Out of Stock</span>'
          : `<span class="badge badge-success">${p.stock} Available in Stock</span>`;
      }

      if (qtyInput) {
        qtyInput.value = '1';
        qtyInput.max = p.stock || 1;
      }

      if (addBtn) {
        addBtn.disabled = isOutOfStock;
        addBtn.textContent = isOutOfStock ? 'Out of Stock' : 'Add to Shopping Cart';
      }

      modal.classList.add('active');
    } catch (err) {
      window.App.showToast('Could not load product details.', 'error');
    }
  },

  bindEvents() {
    // Search input with debounce
    const searchInput = document.getElementById('nav-search-input');
    const searchClear = document.getElementById('search-clear-btn');
    let debounceTimer;

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (searchClear) {
          searchClear.style.display = val ? 'flex' : 'none';
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = val;
          this.fetchProducts();
        }, 300);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.searchQuery = searchInput.value;
          this.fetchProducts();
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        this.searchQuery = '';
        this.fetchProducts();
      });
    }

    // Sort select
    const sortSelect = document.getElementById('sort-products-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.fetchProducts();
      });
    }

    // Product Details Modal Quantity controls
    const qtyMinus = document.getElementById('detail-qty-minus');
    const qtyPlus = document.getElementById('detail-qty-plus');
    const qtyInput = document.getElementById('detail-modal-qty-input');
    const addModalBtn = document.getElementById('detail-modal-add-btn');
    const closeModalBtn = document.getElementById('close-product-modal-btn');
    const productModal = document.getElementById('product-details-modal');

    if (closeModalBtn && productModal) {
      closeModalBtn.addEventListener('click', () => {
        productModal.classList.remove('active');
      });
    }

    if (qtyMinus && qtyInput) {
      qtyMinus.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        if (val > 1) {
          qtyInput.value = val - 1;
          this.modalQty = val - 1;
        }
      });
    }

    if (qtyPlus && qtyInput) {
      qtyPlus.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        const max = this.selectedProduct ? this.selectedProduct.stock : 99;
        if (val < max) {
          qtyInput.value = val + 1;
          this.modalQty = val + 1;
        }
      });
    }

    if (addModalBtn) {
      addModalBtn.addEventListener('click', () => {
        if (!this.selectedProduct) return;
        const qty = parseInt(qtyInput.value, 10) || 1;
        window.Cart.addItem(this.selectedProduct._id, qty);
        productModal.classList.remove('active');
      });
    }
  }
};

window.Store = Store;
