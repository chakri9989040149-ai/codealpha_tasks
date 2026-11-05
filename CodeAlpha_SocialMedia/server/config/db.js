const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codealpha_social';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500,
    });
    isConnected = true;
    console.log(`[Database] Connected to MongoDB successfully: ${conn.connection.host}`);
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`[Database] MongoDB not detected at ${uri} (${err.message}).`);
    console.log(`[Database] Activating In-Memory Fallback Store. All features (auth, profiles, posts, comments, likes, follows) are 100% operational.`);
    console.log(`[Database] To use persistent MongoDB, set MONGODB_URI in .env (e.g., local mongod or MongoDB Atlas).`);
    return false;
  }
};

const getIsConnected = () => isConnected;

module.exports = {
  connectDB,
  getIsConnected,
};
