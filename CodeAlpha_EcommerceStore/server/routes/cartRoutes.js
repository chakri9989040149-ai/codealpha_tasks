const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  syncCart,
  clearCart
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All cart routes require user authentication
router.use(protect);

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:productId', updateCartItem);
router.delete('/items/:productId', removeFromCart);
router.post('/sync', syncCart);
router.delete('/', clearCart);

module.exports = router;
