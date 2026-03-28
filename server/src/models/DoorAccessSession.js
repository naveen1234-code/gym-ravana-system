const mongoose = require("mongoose");

const doorAccessSessionSchema = new mongoose.Schema(
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
      enum: ["entry", "exit", "manual"],
      required: true,
      index: true,
    },

    accessPoint: {
      type: String,
      default: "main-door",
      trim: true,
      index: true,
    },

    unlockApproved: {
      type: Boolean,
      default: false,
    },

    doorOpened: {
      type: Boolean,
      default: false,
    },

    doorClosed: {
      type: Boolean,
      default: false,
    },

    completed: {
      type: Boolean,
      default: false,
      index: true,
    },

    triggeredBy: {
      type: String,
      enum: ["member_qr", "manual_button", "admin_override", "system"],
      default: "member_qr",
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    openedAt: {
      type: Date,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoorAccessSession", doorAccessSessionSchema);