const mongoose = require('mongoose');

let mongoMemoryServerInstance = null;

const connectDB = async () => {
  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    try {
      console.log(`[Database] Attempting connection to MongoDB at: ${uri}`);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000
      });
      console.log(`[Database] MongoDB Connected to host: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.warn(`[Database] Failed to connect to ${uri}: ${err.message}`);
      console.log('[Database] Falling back to high-performance in-memory MongoDB server...');
    }
  }

  // In-memory fallback
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('[Database] Starting in-memory MongoDB instance...');
    mongoMemoryServerInstance = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServerInstance.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to In-Memory MongoDB successfully: ${memoryUri}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Could not establish MongoDB connection: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServerInstance) {
      await mongoMemoryServerInstance.stop();
    }
  } catch (err) {
    console.error('[Database Disconnect Error]', err);
  }
};

module.exports = { connectDB, disconnectDB };
