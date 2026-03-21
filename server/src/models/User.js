const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },

    membershipStatus: {
      type: String,
      enum: ["inactive", "active", "expired"],
      default: "inactive",
    },

    membershipPlan: {
      type: String,
      default: "No Plan",
    },

    membershipStartDate: {
      type: Date,
      default: null,
    },

    membershipEndDate: {
      type: Date,
      default: null,
    },

    totalDays: {
      type: Number,
      default: 0,
    },

    remainingDays: {
      type: Number,
      default: 0,
    },

    attendanceCount: {
      type: Number,
      default: 0,
    },

    lastCheckIn: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);