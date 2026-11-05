// ==========================================================================
// CodeAlpha Store - Checkout & Payment Simulation Module
// ==========================================================================

const Checkout = {
  currentStep: 1,
  shippingAddress: {},
  shippingMethod: 'standard',
  paymentData: {},
  lastCreatedOrder: null,

  init() {
    this.bindEvents();
  },

  openCheckoutModal() {
    if (!Auth.isAuthenticated()) {
      window.App.showToast('Please sign in or create an account to proceed with checkout.', 'info');
      Auth.openAuthModal('login');
      return;
    }

    if (Cart.items.length === 0) {
      window.App.showToast('Your cart is empty. Please add items to checkout.', 'warning');
      return;
    }

    // Prefill name if available
    const nameInput = document.getElementById('checkout-fullname');
    if (nameInput && Auth.user && !nameInput.value) {
      nameInput.value = Auth.user.name || '';
    }

    this.goToStep(1);
    this.updateOrderSummaryPreview();

    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('active');
  },

  goToStep(step) {
    this.currentStep = step;

    // Update step indicator classes
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`step-indicator-${i}`);
      if (stepEl) {
        stepEl.classList.remove('active', 'completed');
        if (i === step) {
          stepEl.classList.add('active');
        } else if (i < step) {
          stepEl.classList.add('completed');
        }
      }

      const panelEl = document.getElementById(`checkout-step-panel-${i}`);
      if (panelEl) {
        if (i === step) {
          panelEl.classList.remove('hidden');
        } else {
          panelEl.classList.add('hidden');
        }
      }
    }

    // Hide processing and confirmation panels
    document.getElementById('checkout-processing-panel')?.classList.add('hidden');
    document.getElementById('checkout-success-panel')?.classList.add('hidden');
  },

  updateOrderSummaryPreview() {
    const previewContainer = document.getElementById('checkout-summary-items');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const taxEl = document.getElementById('checkout-tax');
    const totalEl = document.getElementById('checkout-total');

    let shippingCost = Cart.subtotal > 50 || Cart.subtotal === 0 ? 0 : 9.99;
    if (this.shippingMethod === 'express') {
      shippingCost = 14.99;
    }

    const taxCost = Number((Cart.subtotal * 0.08).toFixed(2));
    const finalTotal = Number((Cart.subtotal + shippingCost + taxCost).toFixed(2));

    if (subtotalEl) subtotalEl.textContent = `$${Cart.subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${taxCost.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${finalTotal.toFixed(2)}`;

    if (previewContainer) {
      previewContainer.innerHTML = Cart.items
        .map(
          (item) => `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; font-size:0.85rem;">
            <span style="color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:200px;">
              ${item.qty}x ${item.title}
            </span>
            <span style="font-weight:600;">$${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `
        )
        .join('');
    }
  },

  async handlePaymentSubmit() {
    // Collect payment details
    const cardNumber = document.getElementById('card-number-input')?.value.replace(/\s+/g, '') || '4242424242424242';
    const cardHolder = document.getElementById('card-holder-input')?.value.trim() || Auth.user?.name || 'Customer';
    const cardExpiry = document.getElementById('card-expiry-input')?.value.trim() || '12/28';
    const cardCvc = document.getElementById('card-cvc-input')?.value.trim() || '123';

    this.paymentData = {
      paymentMethod: 'Credit Card (Simulated)',
      cardNumber,
      cardHolder,
      cardExpiry,
      cardCvc
    };

    // Hide steps, show simulated processing animation
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`checkout-step-panel-${i}`)?.classList.add('hidden');
    }
    document.getElementById('checkout-processing-panel')?.classList.remove('hidden');

    try {
      // Simulate real-world network authorization latency (1.8 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const payload = {
        shippingAddress: this.shippingAddress,
        paymentDetails: this.paymentData
      };

      const res = await API.post('/orders', payload);

      if (res.success && res.order) {
        this.lastCreatedOrder = res.order;

        // Reset cart state
        Cart.items = [];
        Cart.recalculate();

        // Refresh products catalog to reflect updated stock
        Store.fetchProducts();

        // Show confirmation step
        document.getElementById('checkout-processing-panel')?.classList.add('hidden');
        const successPanel = document.getElementById('checkout-success-panel');
        if (successPanel) {
          successPanel.classList.remove('hidden');
          document.getElementById('order-confirmed-id').textContent = res.order._id;
          document.getElementById('order-confirmed-total').textContent = `$${res.order.totalPrice.toFixed(2)}`;
          document.getElementById('order-confirmed-address').textContent = `${res.order.shippingAddress.street}, ${res.order.shippingAddress.city}, ${res.order.shippingAddress.zipCode}`;
        }

        window.App.showToast('Payment successful! Your order has been placed.', 'success');
      }
    } catch (err) {
      document.getElementById('checkout-processing-panel')?.classList.add('hidden');
      this.goToStep(3);
      window.App.showToast(err.message || 'Payment simulation failed.', 'error');
    }
  },

  bindEvents() {
    // Close modal
    document.getElementById('close-checkout-modal-btn')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Step 1: Shipping Address Form Submit
    const step1Form = document.getElementById('checkout-step1-form');
    if (step1Form) {
      step1Form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.shippingAddress = {
          fullName: document.getElementById('checkout-fullname').value.trim(),
          street: document.getElementById('checkout-street').value.trim(),
          city: document.getElementById('checkout-city').value.trim(),
          state: document.getElementById('checkout-state').value.trim(),
          zipCode: document.getElementById('checkout-zip').value.trim(),
          country: document.getElementById('checkout-country')?.value || 'USA',
          phone: document.getElementById('checkout-phone').value.trim()
        };
        this.goToStep(2);
      });
    }

    // Step 2: Shipping Method Options
    document.getElementById('back-to-step1-btn')?.addEventListener('click', () => this.goToStep(1));
    
    document.getElementById('shipping-method-standard')?.addEventListener('change', () => {
      this.shippingMethod = 'standard';
      this.updateOrderSummaryPreview();
    });

    document.getElementById('shipping-method-express')?.addEventListener('change', () => {
      this.shippingMethod = 'express';
      this.updateOrderSummaryPreview();
    });

    document.getElementById('to-step3-btn')?.addEventListener('click', () => {
      this.goToStep(3);
    });

    // Step 3: Payment
    document.getElementById('back-to-step2-btn')?.addEventListener('click', () => this.goToStep(2));

    const step3Form = document.getElementById('checkout-step3-form');
    if (step3Form) {
      step3Form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePaymentSubmit();
      });
    }

    // Live Card Preview formatting
    const cardNumInput = document.getElementById('card-number-input');
    const cardHolderInput = document.getElementById('card-holder-input');
    const cardExpiryInput = document.getElementById('card-expiry-input');

    const previewNum = document.getElementById('preview-card-number');
    const previewName = document.getElementById('preview-card-name');
    const previewExpiry = document.getElementById('preview-card-expiry');

    if (cardNumInput && previewNum) {
      cardNumInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 16);
        let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
        e.target.value = formatted;
        previewNum.textContent = formatted || '•••• •••• •••• 4242';
      });
    }

    if (cardHolderInput && previewName) {
      cardHolderInput.addEventListener('input', (e) => {
        previewName.textContent = e.target.value.trim().toUpperCase() || 'YOUR NAME';
      });
    }

    if (cardExpiryInput && previewExpiry) {
      cardExpiryInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 2) {
          val = val.substring(0, 2) + '/' + val.substring(2);
        }
        e.target.value = val;
        previewExpiry.textContent = val || '12/28';
      });
    }

    // Final Order Confirmation "View My Orders"
    document.getElementById('view-placed-order-btn')?.addEventListener('click', () => {
      this.closeModal();
      window.App.switchView('orders');
    });

    document.getElementById('continue-shopping-success-btn')?.addEventListener('click', () => {
      this.closeModal();
      window.App.switchView('store');
    });
  }
};

window.Checkout = Checkout;
