const mongoose = require('mongoose');

// Test connection using explicit multi-node format (bypasses SRV lookup)
const MONGO_URI = 'mongodb://sennnnaveen2_db_user:2008naveen@ac-rohpizy-shard-00-00.apjmxs4.mongodb.net:27017,ac-rohpizy-shard-00-01.apjmxs4.mongodb.net:27017,ac-rohpizy-shard-00-02.apjmxs4.mongodb.net:27017/?ssl=true&replicaSet=atlas-gq6fmc-shard-0&authSource=admin&retryWrites=true&w=majority';

async function testConnection() {
  console.log('🔍 Testing MongoDB connection with explicit multi-node format...');
  console.log('📡 Connection string:', MONGO_URI.replace(/:([^:@]+)@/, ':****@'));
  
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      ssl: true,
      tlsAllowInvalidCertificates: false,
    });
    
    console.log('✅ MongoDB connection successful!');
    console.log('📊 Database name:', mongoose.connection.name);
    console.log('🔗 Connection state:', mongoose.connection.readyState);
    
    // Test a simple query
    const User = mongoose.model('User', new mongoose.Schema({
      name: String,
      email: String,
    }));
    
    const count = await User.countDocuments();
    console.log('👥 Total users in database:', count);
    
    await mongoose.connection.close();
    console.log('🔌 Connection closed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  }
}

testConnection();
