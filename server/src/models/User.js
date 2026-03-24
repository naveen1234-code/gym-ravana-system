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

    membershipNo: {
  type: String,
  default: "",
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
},

age: {
  type: String,
  default: "",
},

fullName: {
  type: String,
  default: "",
},

title: {
  type: String,
  default: "",
},

birthDay: {
  type: String,
  default: "",
},

birthMonth: {
  type: String,
  default: "",
},

birthYear: {
  type: String,
  default: "",
},

sex: {
  type: String,
  default: "",
},

address: {
  type: String,
  default: "",
},

homeNumber: {
  type: String,
  default: "",
},

mobileNumber: {
  type: String,
  default: "",
},

facebookId: {
  type: String,
  default: "",
},

instaId: {
  type: String,
  default: "",
},

company: {
  type: String,
  default: "",
},

profession: {
  type: String,
  default: "",
},

weight: {
  type: String,
  default: "",
},

height: {
  type: String,
  default: "",
},

medicalNotes: {
  type: String,
  default: "",
},

payment: {
  type: String,
  default: "",
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);