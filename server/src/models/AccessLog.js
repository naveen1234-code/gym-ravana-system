const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema(
  {
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

    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    action: {
      type: String,
      enum: ["entry", "exit"],
      required: true,
      index: true,
    },

    result: {
      type: String,
      enum: ["granted", "denied"],
      required: true,
      index: true,
    },

    reason: {
      type: String,
      default: "",
      trim: true,
    },

    accessPoint: {
      type: String,
      default: "main-door",
      trim: true,
      index: true,
    },

    doorTriggered: {
      type: Boolean,
      default: false,
    },

    doorMode: {
      type: String,
      default: "mock",
      trim: true,
    },

    scanMethod: {
      type: String,
      default: "qr",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccessLog", accessLogSchema);