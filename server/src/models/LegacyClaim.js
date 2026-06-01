const mongoose = require("mongoose");

const legacyClaimSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    claimId: {
      type: String,
      required: true,
      trim: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// Ensure claimId is unique per user
legacyClaimSchema.index({ userId: 1, claimId: 1 }, { unique: true });

module.exports = mongoose.model("LegacyClaim", legacyClaimSchema);