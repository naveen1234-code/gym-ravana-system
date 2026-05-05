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
      enum: ["unlock", "restart", "status"],
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
      enum: [
        "pending",
        "claimed",

        "unlocked",
        "busy",
        "failed",
        "rejected_door_open",
        "rejected_unknown_action",
        "duplicate_ignored",
        "restarting",
        "online",

        "completed",
        "expired",
      ],
      default: "pending",
      index: true,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },

    unlockedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
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

    deviceAckStatus: {
      type: String,
      default: "",
      trim: true,
    },

    deviceMessage: {
      type: String,
      default: "",
      trim: true,
    },

    deviceState: {
      type: String,
      default: "",
      trim: true,
    },

    deviceReed: {
      type: String,
      default: "",
      trim: true,
    },

    deviceFreeHeap: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

doorCommandSchema.index({
  deviceId: 1,
  status: 1,
  expiresAt: 1,
  createdAt: 1,
});

module.exports = mongoose.model("DoorCommand", doorCommandSchema);