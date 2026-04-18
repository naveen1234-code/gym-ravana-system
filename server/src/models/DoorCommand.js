const mongoose = require("mongoose");

const doorCommandSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoorAccessSession",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    action: {
      type: String,
      enum: ["unlock"],
      default: "unlock",
      required: true,
      index: true,
    },

    accessPoint: {
      type: String,
      default: "main-door",
      trim: true,
      index: true,
    },

    deviceId: {
      type: String,
      default: "main-door-controller",
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "claimed", "completed", "expired"],
      default: "pending",
      index: true,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoorCommand", doorCommandSchema);