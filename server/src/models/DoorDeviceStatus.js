const mongoose = require("mongoose");

const doorDeviceStatusSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    online: {
      type: Boolean,
      default: false,
      index: true,
    },

    ip: {
      type: String,
      default: "",
      trim: true,
    },

    state: {
      type: String,
      default: "UNKNOWN",
      trim: true,
      index: true,
    },

    doorClosed: {
      type: Boolean,
      default: false,
    },

    doorOpen: {
      type: Boolean,
      default: false,
    },

    sessionId: {
      type: String,
      default: "",
      trim: true,
    },

    userName: {
      type: String,
      default: "",
      trim: true,
    },

    accessPoint: {
      type: String,
      default: "main-door",
      trim: true,
    },

    lastHeartbeatAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoorDeviceStatus", doorDeviceStatusSchema);