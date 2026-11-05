require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const { initSocket } = require('./sockets/socketHandler');
const errorHandler = require('./middleware/error');

// Route files
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const server = http.createServer(app);



// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});
initSocket(io);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow Google Fonts, FontAwesome and Socket.io CDN
    crossOriginEmbedderPolicy: false,
  })
);

// Enable CORS
app.use(cors());

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Assets
const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'CodeAlpha Boards API',
    time: new Date().toISOString(),
  });
});

// SPA fallback for HTML5 routing
app.get('*', (req, res, next) => {
  // If request begins with /api, pass to 404 handler
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

const User = require('./models/User');
const { seedData } = require('./seed');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Auto-seed if database is brand new (e.g. In-memory Mongo)
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Server] Database is empty. Running auto-seed with demo data...');
      await seedData();
    }

    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 CodeAlpha Boards server running on port ${PORT}`);
      console.log(`🔗 http://localhost:${PORT}`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('[Server Error] Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Server Error] Unhandled Rejection: ${err.message}`);
});

process.on('uncaughtException', (err) => {
  console.error(`[Server Error] Uncaught Exception:`, err);
});

