// ==========================================================================
// CodeAlpha Store - Shopping Cart Module
// ==========================================================================

const Cart = {
  items: [],
  subtotal: 0,
  taxPrice: 0,
  shippingPrice: 0,
  totalPrice: 0,
  itemCount: 0,

  async init() {
    this.bindEvents();
    if (Auth.isAuthenticated()) {
      await this.fetchServerCart();
    } else {
      this.loadLocalCart();
    }
  },

  loadLocalCart() {
    try {
      const saved = localStorage.getItem('codealpha_guest_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.items = parsed.items || [];
        this.recalculate();
      } else {
        this.items = [];
        this.recalculate();
      }
    } catch (e) {
      this.items = [];
      this.recalculate();
    }
  },

  saveLocalCart() {
    localStorage.setItem(
      'codealpha_guest_cart',
      JSON.stringify({
        items: this.items
      })
    );
  },

  clearLocalCart() {
    this.items = [];
    localStorage.removeItem('codealpha_guest_cart');
    this.recalculate();
  },

  async fetchServerCart() {
    try {
      const res = await API.get('/cart');
      if (res.success && res.cart) {
        this.items = res.cart.items || [];
        this.itemCount = res.cart.itemCount || 0;
        this.subtotal = res.cart.subtotal || 0;
        this.shippingPrice = res.cart.shippingPrice || 0;
        this.taxPrice = res.cart.taxPrice || 0;
        this.totalPrice = res.cart.totalPrice || 0;
        this.updateUI();
      }
    } catch (err) {
      console.warn('Could not fetch server cart, using local:', err);
      this.loadLocalCart();
    }
  },

  async syncWithServer() {
    const guestCart = localStorage.getItem('codealpha_guest_cart');
    if (!guestCart) {
      return this.fetchServerCart();
    }

    try {
      const parsed = JSON.parse(guestCart);
      if (parsed.items && parsed.items.length > 0) {
        const payload = parsed.items.map((i) => ({
          productId: i.productId,
          qty: i.qty
        }));
        await API.post('/cart/sync', { items: payload });
        localStorage.removeItem('codealpha_guest_cart');
      }
      await this.fetchServerCart();
    } catch (err) {
      console.error('Cart sync error:', err);
      await this.fetchServerCart();
    }
  },

  async addItem(productId, qty = 1, event = null) {
    if (event) {
      event.stopPropagation();
    }

    if (Auth.isAuthenticated()) {
      try {
        const res = await API.post('/cart/items', { productId, qty });
        if (res.success && res.cart) {
          this.applyServerCart(res.cart);
          window.App.showToast('Item added to cart!', 'success');
          this.animateBadge();
        }
      } catch (err) {
        window.App.showToast(err.message || 'Could not add item to cart', 'error');
      }
    } else {
      // Guest local cart
      const product = Store.products.find((p) => p._id === productId);
      if (!product) return;

      if (product.stock < 1) {
        window.App.showToast('This product is out of stock', 'error');
        return;
      }

      const existingIndex = this.items.findIndex((i) => i.productId === productId);
      if (existingIndex > -1) {
        const newQty = this.items[existingIndex].qty + qty;
        if (newQty > product.stock) {
          window.App.showToast(`Only ${product.stock} items available in stock`, 'warning');
          return;
        }
        this.items[existingIndex].qty = newQty;
        this.items[existingIndex].itemTotal = Number((this.items[existingIndex].price * newQty).toFixed(2));
      } else {
        this.items.push({
          productId: product._id,
          title: product.title,
          price: product.price,
          image: product.image,
          stock: product.stock,
          category: product.category,
          qty: qty,
          itemTotal: Number((product.price * qty).toFixed(2))
        });
      }

      this.recalculate();
      this.saveLocalCart();
      window.App.showToast('Item added to cart!', 'success');
      this.animateBadge();
    }
  },

  async updateQuantity(productId, qty) {
    if (Auth.isAuthenticated()) {
      try {
        const res = await API.put(`/cart/items/${productId}`, { qty });
        if (res.success && res.cart) {
          this.applyServerCart(res.cart);
        }
      } catch (err) {
        window.App.showToast(err.message || 'Could not update quantity', 'error');
      }
    } else {
      const idx = this.items.findIndex((i) => i.productId === productId);
      if (idx > -1) {
        if (qty <= 0) {
          this.items.splice(idx, 1);
        } else {
          const item = this.items[idx];
          if (qty > item.stock) {
            window.App.showToast(`Only ${item.stock} available in stock`, 'warning');
            return;
          }
          item.qty = qty;
          item.itemTotal = Number((item.price * qty).toFixed(2));
        }
        this.recalculate();
        this.saveLocalCart();
      }
    }
  },

  async removeItem(productId) {
    if (Auth.isAuthenticated()) {
      try {
        const res = await API.delete(`/cart/items/${productId}`);
        if (res.success && res.cart) {
          this.applyServerCart(res.cart);
          window.App.showToast('Item removed from cart', 'info');
        }
      } catch (err) {
        window.App.showToast('Could not remove item', 'error');
      }
    } else {
      this.items = this.items.filter((i) => i.productId !== productId);
      this.recalculate();
      this.saveLocalCart();
      window.App.showToast('Item removed from cart', 'info');
    }
  },

  applyServerCart(cartData) {
    this.items = cartData.items || [];
    this.itemCount = cartData.itemCount || 0;
    this.subtotal = cartData.subtotal || 0;
    this.shippingPrice = cartData.shippingPrice || 0;
    this.taxPrice = cartData.taxPrice || 0;
    this.totalPrice = cartData.totalPrice || 0;
    this.updateUI();
  },

  recalculate() {
    this.itemCount = this.items.reduce((acc, curr) => acc + curr.qty, 0);
    this.subtotal = Number(
      this.items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0).toFixed(2)
    );
    this.shippingPrice = this.subtotal > 50 || this.subtotal === 0 ? 0 : 9.99;
    this.taxPrice = Number((this.subtotal * 0.08).toFixed(2));
    this.totalPrice = Number((this.subtotal + this.shippingPrice + this.taxPrice).toFixed(2));
    this.updateUI();
  },

  animateBadge() {
    const badge = document.getElementById('nav-cart-badge');
    if (badge) {
      badge.style.animation = 'none';
      badge.offsetHeight; // trigger reflow
      badge.style.animation = 'badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    }
  },

  updateUI() {
    const badge = document.getElementById('nav-cart-badge');
    const drawerCount = document.getElementById('cart-drawer-count');
    const itemsContainer = document.getElementById('cart-drawer-items');
    const emptyMsg = document.getElementById('cart-empty-state');
    const checkoutBtn = document.getElementById('cart-checkout-btn');

    // Totals
    const subtotalEl = document.getElementById('cart-subtotal-val');
    const shippingEl = document.getElementById('cart-shipping-val');
    const taxEl = document.getElementById('cart-tax-val');
    const totalEl = document.getElementById('cart-total-val');

    if (badge) {
      badge.textContent = this.itemCount;
      badge.style.display = this.itemCount > 0 ? 'flex' : 'none';
    }

    if (drawerCount) {
      drawerCount.textContent = `(${this.itemCount} ${this.itemCount === 1 ? 'item' : 'items'})`;
    }

    if (subtotalEl) subtotalEl.textContent = `$${this.subtotal.toFixed(2)}`;
    if (shippingEl) {
      shippingEl.textContent = this.shippingPrice === 0 ? 'FREE' : `$${this.shippingPrice.toFixed(2)}`;
      shippingEl.style.color = this.shippingPrice === 0 ? 'var(--success)' : 'inherit';
    }
    if (taxEl) taxEl.textContent = `$${this.taxPrice.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${this.totalPrice.toFixed(2)}`;

    if (checkoutBtn) {
      checkoutBtn.disabled = this.items.length === 0;
    }

    if (!itemsContainer) return;

    if (this.items.length === 0) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      itemsContainer.innerHTML = '';
      return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');

    itemsContainer.innerHTML = this.items
      .map(
        (item) => `
        <div class="cart-item" data-id="${item.productId}">
          <img 
            src="${item.image}" 
            alt="${item.title}" 
            class="cart-item-img"
            onerror="this.src='https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'"
          />
          <div class="cart-item-details">
            <h4 class="cart-item-title" title="${item.title}">${item.title}</h4>
            <div class="cart-item-price">$${item.price.toFixed(2)}</div>
            <div class="cart-item-actions">
              <div class="cart-qty-ctrl">
                <button 
                  class="cart-qty-btn" 
                  onclick="Cart.updateQuantity('${item.productId}', ${item.qty - 1})"
                  title="Decrease"
                >−</button>
                <span class="cart-qty-val">${item.qty}</span>
                <button 
                  class="cart-qty-btn" 
                  onclick="Cart.updateQuantity('${item.productId}', ${item.qty + 1})"
                  title="Increase"
                  ${item.qty >= item.stock ? 'disabled' : ''}
                >+</button>
              </div>
              <button 
                class="cart-remove-btn" 
                onclick="Cart.removeItem('${item.productId}')"
                title="Remove Item"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Remove
              </button>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  },

  openDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (backdrop) backdrop.classList.add('active');
  },

  closeDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (backdrop) backdrop.classList.remove('active');
  },

  bindEvents() {
    const triggerBtn = document.getElementById('nav-cart-trigger');
    const closeBtn = document.getElementById('close-cart-drawer-btn');
    const backdrop = document.getElementById('cart-drawer-backdrop');
    const continueBtn = document.getElementById('cart-continue-shopping-btn');
    const checkoutBtn = document.getElementById('cart-checkout-btn');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.openDrawer());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeDrawer();
        }
      });
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (this.items.length === 0) return;
        this.closeDrawer();
        window.Checkout.openCheckoutModal();
      });
    }
  }
};

window.Cart = Cart;
