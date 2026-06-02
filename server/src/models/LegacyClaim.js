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
    legacyPlan: {
      type: String,
      required: true,
      enum: ["1 Year", "6 Months", "3 Months", "Monthly"],
      default: "Monthly",
    },
    claimedPhoneNumber: {
      type: String,
      default: "",
      trim: true,
    },
    startMonth: {
      type: String,
      default: "",
      trim: true,
    },
    startYear: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    ledgerDetails: {
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