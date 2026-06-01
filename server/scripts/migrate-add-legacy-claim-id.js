// Migration script to add legacyClaimId field to existing User documents
// Run with: node server/scripts/migrate-add-legacy-claim-id.js

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym_ravana';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');

    // Update all users that do not have legacyClaimId field set (including those where it is undefined)
    // We set it to null, which is the default we set in the schema.
    const result = await User.updateMany(
      { legacyClaimId: { $exists: false } },
      { $set: { legacyClaimId: null } }
    );

    console.log(`Migration completed. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    // Also, we can optionally set the membershipStatus to 'pending_legacy' for users that have a legacy claim?
    // But note: we are not creating legacy claims in this migration. This migration only adds the field.
    // The legacy claims will be created via the registration process or admin process.

    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });