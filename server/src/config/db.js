const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Enable query logging for performance profiling
    mongoose.set('debug', (collectionName, method, query, doc, options) => {
      console.log(`[DB QUERY] ${collectionName}.${method} executed`);
    });

    // Set connection event handlers BEFORE connecting
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Wait for connection to be fully established with retry logic
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Reduced to 5 seconds for fast fail
      socketTimeoutMS: 45000,
      ssl: true,
      tlsAllowInvalidCertificates: false,
      connectTimeoutMS: 5000, // Reduced to 5 seconds for fast fail
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10, // Connection pooling for concurrent requests
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      family: 4, // Force IPv4 to avoid IPv6 DNS resolution issues
    });

    console.log("MongoDB connected with connection pool configured");

  } catch (error) {
    console.error("MONGO DB RAW ERROR:", error);
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    console.error("MONGO_URI value:", process.env.MONGO_URI ? "SET" : "UNDEFINED");
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  try {
    console.log('Closing MongoDB connection...');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = connectDB;