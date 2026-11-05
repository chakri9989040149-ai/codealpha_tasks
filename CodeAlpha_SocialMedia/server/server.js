require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const Store = require('./models/store');

const app = express();
let PORT = parseInt(process.env.PORT, 10) || 3002;

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: ["'self'", 'https:', 'http:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve client assets & static files
app.use(express.static(path.join(__dirname, '..', 'client')));

// API Health / Status
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    name: 'CodeAlpha Social API',
    version: '1.0.0',
    timestamp: new Date(),
    database: Store.getStats(),
  });
});

// Mount REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// SPA client fallback (serve index.html for frontend routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint '${req.originalUrl}' not found`,
    });
  }
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDB();

  // If in-memory and empty, automatically seed initial demo accounts & posts
  const { seedData } = require('./scripts/seed');
  await seedData({ silent: true });

  const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` 🚀 CodeAlpha Social is running at http://localhost:${PORT}`);
    console.log(` 📡 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(` 💾 Storage: ${Store.isMongooseActive() ? 'MongoDB (Mongoose)' : 'In-Memory Store'}`);
    console.log(`=======================================================`);
  });

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
