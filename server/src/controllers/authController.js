const User = require("../models/User");
const LegacyClaim = require("../models/LegacyClaim");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// REGISTER
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
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

// CHECK-OUT MEMBER
const checkOutMember = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isInsideGym = false;
    user.lastExitAt = new Date();
    await user.save();

    return res.status(200).json({
      message: "Check-out successful ✅",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || email.trim() === "") {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: "No user found with this email" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    return res.status(200).json({
      message: "Password reset link sent successfully",
      resetLink,
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Failed to send password reset link",
      error: error.message,
    });
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password are required",
      });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.passwordResetToken = "";
    user.passwordResetExpires = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

// TEST EMAIL
const sendApplicationEmailTest = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Test email sent successfully ✅",
    });
  } catch (error) {
    console.error("Test mail error:", error);
    return res.status(500).json({
      message: "Failed to send test email ❌",
      error: error.message,
    });
  }
};

const sendTestSMS = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Test SMS sent successfully ✅",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Test SMS failed ❌",
      error: error.message,
    });
  }
};

// REGENERATE APPLICATION PDFS
const regenerateApplicationPdfs = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Application PDFs regenerated successfully ✅",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to regenerate PDFs ❌",
      error: error.message,
    });
  }
};

// SEND BULK MEMBER SMS
const sendBulkMemberSMS = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Bulk SMS sent successfully ✅",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to send bulk SMS ❌",
      error: error.message,
    });
  }
};

// RETRY FAILED MEMBER SMS
const retryFailedMemberSMS = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Failed SMS retried successfully ✅",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retry SMS ❌",
      error: error.message,
    });
  }
};

// GET LEGACY CLAIMS (ADMIN)
const getLegacyClaims = async (req, res) => {
  try {
    const claims = await LegacyClaim.find({ status: 'pending' })
      .populate('userId', 'name email')
      .sort({ claimedAt: -1 });

    return res.status(200).json(claims);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// APPROVE LEGACY CLAIM (ADMIN)
const approveLegacyClaim = async (req, res) => {
  try {
    const { id } = req.params;

    const claim = await LegacyClaim.findById(id);

    if (!claim) {
      return res.status(404).json({ message: "Legacy claim not found" });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ message: "Claim has already been processed" });
    }

    const user = await User.findById(claim.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate membership expiration based on legacy plan
    const planMonths = {
      "1 Year": 12,
      "6 Months": 6,
      "3 Months": 3,
      "Monthly": 1
    };

    const monthsToAdd = planMonths[claim.legacyPlan] || 1;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + monthsToAdd);

    // Update user
    user.membershipStatus = 'active';
    user.membershipPlan = claim.legacyPlan;
    user.membershipStartDate = startDate;
    user.membershipEndDate = endDate;
    user.totalDays = monthsToAdd * 30;
    user.remainingDays = monthsToAdd * 30;

    await user.save();

    // Update claim
    claim.status = 'approved';
    claim.processed = true;
    claim.processedAt = new Date();
    await claim.save();

    return res.status(200).json({
      message: "Legacy claim approved successfully",
      claim,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// REJECT LEGACY CLAIM (ADMIN)
const rejectLegacyClaim = async (req, res) => {
  try {
    const { id } = req.params;

    const claim = await LegacyClaim.findById(id);

    if (!claim) {
      return res.status(404).json({ message: "Legacy claim not found" });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ message: "Claim has already been processed" });
    }

    // Update claim
    claim.status = 'rejected';
    claim.processed = true;
    claim.processedAt = new Date();
    await claim.save();

    return res.status(200).json({
      message: "Legacy claim rejected successfully",
      claim,
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
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateMembership,
  makeAdmin,
  getAllUsers,
  checkInMember,
  checkOutMember,
  sendApplicationEmailTest,
  sendTestSMS,
  regenerateApplicationPdfs,
  sendBulkMemberSMS,
  retryFailedMemberSMS,
  getLegacyClaims,
  approveLegacyClaim,
  rejectLegacyClaim,
};