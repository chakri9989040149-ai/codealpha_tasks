require('dotenv').config();
const app = require('./server/app');
const { connectDB } = require('./server/config/db');

const PORT = process.env.PORT || 5000;
const Product = require('./server/models/Product');
const seedData = require('./server/seeds/seed');

const startServer = async () => {
  try {
    await connectDB();

    // Auto-seed if database is brand new/empty
    const count = await Product.countDocuments();
    if (count === 0) {
      console.log('[Server] Database is empty, seeding default products & demo accounts...');
      await seedData();
    }

    const server = app.listen(PORT, () => {
      console.log('==================================================');
      console.log(`🚀 CodeAlpha Store running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log('==================================================');
    });

    // Graceful shutdown handling
    const shutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] Closed all connections.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
};

startServer();
