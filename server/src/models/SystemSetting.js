const mongoose = require("mongoose");

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    maintenanceMode: {
      type: Boolean,
      default: false,
      index: true,
    },

    title: {
      type: String,
      default: "GYM RAVANA DIGITAL SYSTEM",
      trim: true,
    },

    headline: {
      type: String,
      default: "SYSTEM TEMPORARILY SHUT DOWN",
      trim: true,
    },

    message: {
      type: String,
      default:
        "We are currently upgrading the Gym Ravana digital system. Access app, account dashboard, QR scanning, and member features are temporarily unavailable. Please check back soon.",
      trim: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSetting", systemSettingSchema);