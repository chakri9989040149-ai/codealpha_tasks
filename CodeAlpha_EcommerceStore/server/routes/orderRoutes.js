const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  getAdminSummary
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All order routes require authentication
router.use(protect);

// Customer & General authenticated routes
router.post('/', createOrder);
router.get('/myorders', getMyOrders);
router.get('/:id', getOrderById);

// Admin-only routes
router.get('/', authorize('admin'), getAllOrders);
router.get('/admin/summary', authorize('admin'), getAdminSummary);
router.put('/:id/status', authorize('admin'), updateOrderStatus);

module.exports = router;
