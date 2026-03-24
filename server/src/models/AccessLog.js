const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    userName: {
      type: String,
      required: true,
    },

    userEmail: {
      type: String,
      required: true,
    },

    action: {
      type: String,
      enum: ["entry", "exit"],
      required: true,
    },

    result: {
      type: String,
      enum: ["granted", "denied"],
      required: true,
    },

    reason: {
      type: String,
      default: "",
    },

    accessPoint: {
      type: String,
      default: "main-door",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccessLog", accessLogSchema);