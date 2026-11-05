const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Helper to format and calculate totals
const formatCartResponse = (cart) => {
  if (!cart) {
    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
      taxPrice: 0,
      shippingPrice: 0,
      totalPrice: 0
    };
  }

  // Filter out any items where product may have been deleted
  const validItems = cart.items.filter((item) => item.product != null);

  const formattedItems = validItems.map((item) => {
    const prod = item.product;
    const price = prod.price || 0;
    const itemTotal = Number((price * item.qty).toFixed(2));
    return {
      productId: prod._id,
      title: prod.title,
      price: prod.price,
      image: prod.image,
      stock: prod.stock,
      category: prod.category,
      qty: item.qty,
      itemTotal
    };
  });

  const itemCount = formattedItems.reduce((acc, curr) => acc + curr.qty, 0);
  const subtotal = Number(
    formattedItems.reduce((acc, curr) => acc + curr.itemTotal, 0).toFixed(2)
  );
  // Free shipping over $50, else $9.99
  const shippingPrice = subtotal > 50 || subtotal === 0 ? 0 : 9.99;
  // Estimated 8% tax
  const taxPrice = Number((subtotal * 0.08).toFixed(2));
  const totalPrice = Number((subtotal + shippingPrice + taxPrice).toFixed(2));

  return {
    cartId: cart._id,
    items: formattedItems,
    itemCount,
    subtotal,
    taxPrice,
    shippingPrice,
    totalPrice
  };
};

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.status(200).json({
      success: true,
      cart: formatCartResponse(cart)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, qty = 1 } = req.body;
    const quantity = Math.max(1, parseInt(qty, 10) || 1);

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.stock < 1) {
      return res.status(400).json({
        success: false,
        message: 'Product is currently out of stock'
      });
    }

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex > -1) {
      const newQty = cart.items[itemIndex].qty + quantity;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than available stock (${product.stock} available)`
        });
      }
      cart.items[itemIndex].qty = newQty;
    } else {
      if (quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Requested quantity exceeds available stock (${product.stock} available)`
        });
      }
      cart.items.push({ product: productId, qty: quantity });
    }

    await cart.save();
    cart = await Cart.findById(cart._id).populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Product added to cart',
      cart: formatCartResponse(cart)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update item quantity in cart
// @route   PUT /api/cart/items/:productId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { qty } = req.body;
    const quantity = parseInt(qty, 10);

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not in cart'
      });
    }

    if (quantity <= 0) {
      // Remove item if quantity is zero or less
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);
      if (!product) {
        cart.items.splice(itemIndex, 1);
      } else if (quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available in stock`
        });
      } else {
        cart.items[itemIndex].qty = quantity;
      }
    }

    await cart.save();
    cart = await Cart.findById(cart._id).populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: formatCartResponse(cart)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:productId
// @access  Private
exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId.toString()
    );

    await cart.save();
    cart = await Cart.findById(cart._id).populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart: formatCartResponse(cart)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Batch sync guest cart items into user's DB cart on login
// @route   POST /api/cart/sync
// @access  Private
exports.syncCart = async (req, res, next) => {
  try {
    const { items = [] } = req.body;

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    for (const guestItem of items) {
      if (!guestItem.productId) continue;
      const product = await Product.findById(guestItem.productId);
      if (!product || product.stock < 1) continue;

      const existingIndex = cart.items.findIndex(
        (i) => i.product.toString() === guestItem.productId.toString()
      );

      const addQty = Math.max(1, parseInt(guestItem.qty, 10) || 1);

      if (existingIndex > -1) {
        cart.items[existingIndex].qty = Math.min(
          cart.items[existingIndex].qty + addQty,
          product.stock
        );
      } else {
        cart.items.push({
          product: guestItem.productId,
          qty: Math.min(addQty, product.stock)
        });
      }
    }

    await cart.save();
    cart = await Cart.findById(cart._id).populate('items.product');

    res.status(200).json({
      success: true,
      message: 'Cart synchronized',
      cart: formatCartResponse(cart)
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      cart: formatCartResponse(cart)
    });
  } catch (err) {
    next(err);
  }
};
