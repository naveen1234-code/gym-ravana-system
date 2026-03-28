const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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

    planName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["PayHere", "Cash", "Bank Transfer", "Manual"],
      default: "PayHere",
      index: true,
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    receiptNumber: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    recordedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    recordedByAdminName: {
      type: String,
      default: "",
      trim: true,
    },

    paidAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);