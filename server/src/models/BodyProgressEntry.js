const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["front", "side", "back"],
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  { _id: false }
);

const bodyProgressEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    weightKg: {
      type: Number,
      default: null,
    },

    chestCm: { type: Number, default: null },
    waistCm: { type: Number, default: null },
    hipsCm: { type: Number, default: null },
    armCm: { type: Number, default: null },
    thighCm: { type: Number, default: null },

    photos: {
      type: [photoSchema],
      default: [],
    },

    createdBy: {
      actor: { type: String, enum: ["member", "admin"], required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },

    updatedBy: {
      actor: { type: String, enum: ["member", "admin"], default: null },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

bodyProgressEntrySchema.index({ userId: 1, recordedAt: 1 });
bodyProgressEntrySchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model("BodyProgressEntry", bodyProgressEntrySchema);

