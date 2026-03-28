const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
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
      trim: true,
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

    lastDayDeductedAt: {
      type: Date,
      default: null,
    },

    isInsideGym: {
      type: Boolean,
      default: false,
    },

    lastEntryAt: {
      type: Date,
      default: null,
    },

    lastExitAt: {
      type: Date,
      default: null,
    },

    membershipNo: {
      type: String,
      default: "",
      trim: true,
    },

    date: {
      type: String,
      default: "",
    },

    powerTraining: {
      type: Boolean,
      default: false,
    },

    fatBurning: {
      type: Boolean,
      default: false,
    },

    zumba: {
      type: Boolean,
      default: false,
    },

    yoga: {
      type: Boolean,
      default: false,
    },

    nicPassport: {
      type: String,
      default: "",
      trim: true,
    },

    age: {
      type: String,
      default: "",
      trim: true,
    },

    fullName: {
      type: String,
      default: "",
      trim: true,
    },

    title: {
      type: String,
      default: "",
      trim: true,
    },

    birthDay: {
      type: String,
      default: "",
      trim: true,
    },

    birthMonth: {
      type: String,
      default: "",
      trim: true,
    },

    birthYear: {
      type: String,
      default: "",
      trim: true,
    },

    sex: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    homeNumber: {
      type: String,
      default: "",
      trim: true,
    },

    mobileNumber: {
      type: String,
      default: "",
      trim: true,
    },

    facebookId: {
      type: String,
      default: "",
      trim: true,
    },

    instaId: {
      type: String,
      default: "",
      trim: true,
    },

    company: {
      type: String,
      default: "",
      trim: true,
    },

    profession: {
      type: String,
      default: "",
      trim: true,
    },

    weight: {
      type: String,
      default: "",
      trim: true,
    },

    height: {
      type: String,
      default: "",
      trim: true,
    },

    medicalNotes: {
      type: String,
      default: "",
      trim: true,
    },

    payment: {
      type: String,
      default: "",
      trim: true,
    },

    applicationPdfUrl: {
      type: String,
      default: "",
      trim: true,
    },

    applicationSubmittedAt: {
      type: Date,
      default: null,
    },

    memberSignature: {
      type: String,
      default: "",
    },

    passwordResetToken: {
      type: String,
      default: "",
    },

    passwordResetExpires: {
      type: Date,
      default: null,
    },

    notificationFlags: {
      warning7: {
        type: Boolean,
        default: false,
      },
      warning3: {
        type: Boolean,
        default: false,
      },
      warning1: {
        type: Boolean,
        default: false,
      },
      expired: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);