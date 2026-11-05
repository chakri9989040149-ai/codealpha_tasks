const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Create new order from cart / checkout
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentDetails } = req.body;

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.street || !shippingAddress.city || !shippingAddress.zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a complete shipping address (fullName, street, city, zipCode)'
      });
    }

    // Retrieve user's cart
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add items before checking out.'
      });
    }

    // Verify stock and prepare order items
    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      if (!item.product) {
        continue;
      }

      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.product.title || 'Unknown'}" is no longer available.`
        });
      }

      if (product.stock < item.qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.title}". Only ${product.stock} left in stock.`
        });
      }

      const itemTotal = Number((product.price * item.qty).toFixed(2));
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        title: product.title,
        price: product.price,
        image: product.image,
        qty: item.qty
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const shippingPrice = subtotal > 50 ? 0 : 9.99;
    const taxPrice = Number((subtotal * 0.08).toFixed(2));
    const totalPrice = Number((subtotal + shippingPrice + taxPrice).toFixed(2));

    // Deduct stock for all items
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.qty }
      });
    }

    // Simulated transaction details
    const simulatedCardLast4 = paymentDetails?.cardNumber
      ? paymentDetails.cardNumber.slice(-4)
      : '4242';

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      shippingAddress: {
        fullName: shippingAddress.fullName,
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state || '',
        zipCode: shippingAddress.zipCode,
        country: shippingAddress.country || 'USA',
        phone: shippingAddress.phone || 'N/A'
      },
      paymentMethod: paymentDetails?.paymentMethod || 'Credit Card (Simulated)',
      paymentResult: {
        transactionId: 'TXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        status: 'COMPLETED',
        cardLast4: simulatedCardLast4
      },
      subtotal,
      taxPrice,
      shippingPrice,
      totalPrice,
      status: 'Processing',
      isPaid: true,
      paidAt: new Date()
    });

    // Clear user's cart
    cart.items = [];
    await cart.save();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization: must be the owner or admin
    if (order.user._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
// @access  Private/Admin
exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.status = status;
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get dashboard metrics & summary (Admin only)
// @route   GET /api/orders/summary
// @access  Private/Admin
exports.getAdminSummary = async (req, res, next) => {
  try {
    const [orders, productCount, lowStockCount] = await Promise.all([
      Order.find(),
      Product.countDocuments(),
      Product.countDocuments({ stock: { $lte: 5 } })
    ]);

    const totalOrders = orders.length;
    const totalRevenue = Number(
      orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0).toFixed(2)
    );
    const deliveredOrders = orders.filter((o) => o.status === 'Delivered').length;
    const pendingOrders = orders.filter(
      (o) => o.status === 'Processing' || o.status === 'Pending'
    ).length;

    res.status(200).json({
      success: true,
      summary: {
        totalRevenue,
        totalOrders,
        totalProducts: productCount,
        lowStockProducts: lowStockCount,
        deliveredOrders,
        pendingOrders
      }
    });
  } catch (err) {
    next(err);
  }
};
