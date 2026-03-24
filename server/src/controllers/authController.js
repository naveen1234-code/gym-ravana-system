const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER
const registerUser = async (req, res) => {
  try {
    
    const {
  email,
  password,
  membershipNo,
  date,
  powerTraining,
  fatBurning,
  zumba,
  yoga,
  nicPassport,
  age,
  fullName,
  title,
  birthDay,
  birthMonth,
  birthYear,
  sex,
  address,
  homeNumber,
  mobileNumber,
  facebookId,
  instaId,
  company,
  profession,
  weight,
  height,
  medicalNotes,
  payment,
} = req.body;

    if (!fullName || fullName.trim() === "") {
  return res.status(400).json({ message: "Full name is required" });
}

if (!email || email.trim() === "") {
  return res.status(400).json({ message: "Email is required" });
}

if (!password || password.trim() === "") {
  return res.status(400).json({ message: "Password is required" });
}

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
  name: fullName,
  fullName,
  email,
  password: hashedPassword,
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
  console.error("REGISTER ERROR:", error);
  return res.status(500).json({
    message: "Server error",
    error: error.message,
  });
}
};

// LOGIN
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please enter email and password" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET CURRENT USER
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // AUTO EXPIRE LOGIC
    if (user.remainingDays <= 0 && user.membershipStatus === "active") {
      user.membershipStatus = "expired";
      await user.save();
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// UPDATE MEMBERSHIP
const updateMembership = async (req, res) => {
  try {
    const {
      userId,
      membershipStatus,
      membershipPlan,
      membershipStartDate,
      membershipEndDate,
      totalDays,
      remainingDays,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.membershipStatus = membershipStatus || user.membershipStatus;
    user.membershipPlan = membershipPlan || user.membershipPlan;
    user.membershipStartDate = membershipStartDate || user.membershipStartDate;
    user.membershipEndDate = membershipEndDate || user.membershipEndDate;
    user.totalDays =
      totalDays !== undefined ? totalDays : user.totalDays;
    user.remainingDays =
      remainingDays !== undefined ? remainingDays : user.remainingDays;

    await user.save();

    return res.status(200).json({
      message: "Membership updated successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// MAKE ADMIN
const makeAdmin = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = "admin";
    await user.save();

    return res.status(200).json({
      message: "User role updated to admin",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET ALL USERS
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
const GYM_QR_VALUE = require("../config/gymQr");

const checkInMember = async (req, res) => {
  try {
    const { scannedQrValue } = req.body;

    if (!scannedQrValue) {
      return res.status(400).json({ message: "QR value is required" });
    }

    if (scannedQrValue !== GYM_QR_VALUE) {
      return res.status(400).json({ message: "Invalid gym QR code" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.membershipStatus !== "active") {
      return res.status(400).json({ message: "Membership is not active" });
    }

    if (user.remainingDays <= 0) {
      user.membershipStatus = "expired";
      await user.save();
      return res.status(400).json({ message: "No remaining days left" });
    }

    const today = new Date();
    const todayString = today.toDateString();

    if (user.lastCheckIn) {
      const lastCheckInString = new Date(user.lastCheckIn).toDateString();

      if (lastCheckInString === todayString) {
        return res.status(400).json({ message: "Already checked in today" });
      }
    }

    user.attendanceCount += 1;
    user.remainingDays -= 1;
    user.lastCheckIn = today;

    if (user.remainingDays <= 0) {
      user.membershipStatus = "expired";
    }

    await user.save();

    return res.status(200).json({
      message: "Check-in successful ✅",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateMembership,
  makeAdmin,
  getAllUsers,
  checkInMember,
};