const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gym-ravana')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Clear measurementHistory and progressPhotos arrays
    const result = await mongoose.connection.db.collection('users').updateMany(
      {},
      {
        $unset: {
          'healthMetrics.measurementHistory': '',
          'healthMetrics.progressPhotos': ''
        }
      }
    );
    
    console.log('Cleared arrays from', result.modifiedCount, 'users');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
