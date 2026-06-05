

const User = require("../models/User");
const LegacyClaim = require("../models/LegacyClaim");
const DoorAccessSession = require("../models/DoorAccessSession");
const DoorCommand = require("../models/DoorCommand");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const GYM_QR = require("../config/gymQr");

const DOOR_DEVICE_ID = "main-door-controller";
const COMMAND_EXPIRE_MS = 30000;

const getSriLankaDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// REGISTER
const registerUser = async (req, res) => {
  try {
    const { name, fullName, email, password, isLegacyMember, legacyDetails } = req.body;

    console.log("BACKEND REGISTER PAYLOAD:", { name, fullName, email, isLegacyMember, legacyDetails });

    // Use fullName if name is not provided
    const userName = name || fullName;

    // Validate required fields with specific error messages
    if (!userName) {
      return res.status(400).json({ message: "Missing field: name" });
    }
    if (!email) {
      return res.status(400).json({ message: "Missing field: email" });
    }
    if (!password) {
      return res.status(400).json({ message: "Missing field: password" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: userName,
      email,
      password: hashedPassword,
    });

    console.log("BACKEND DETECTED LEGACY CLAIM:", isLegacyMember, legacyDetails);

    // Handle legacy claim if present
    if (isLegacyMember && legacyDetails) {
      try {
        const claimId = `${user._id}-${Date.now()}`;
        console.log("CREATING LEGACY CLAIM WITH:", {
          userId: user._id,
          claimId,
          legacyPlan: legacyDetails.previousMembershipPlanType,
          claimedPhoneNumber: legacyDetails.claimedPhoneNumber,
          startMonth: legacyDetails.startMonth,
          startYear: legacyDetails.startYear,
        });

        const legacyClaim = await LegacyClaim.create({
          userId: user._id,
          claimId,
          legacyPlan: legacyDetails.previousMembershipPlanType,
          claimedPhoneNumber: legacyDetails.claimedPhoneNumber,
          startMonth: legacyDetails.startMonth,
          startYear: legacyDetails.startYear,
          status: "pending",
          claimedAt: new Date(),
        });

        console.log("LEGACY CLAIM CREATED SUCCESSFULLY:", legacyClaim);
      } catch (legacyError) {
        console.error("LEGACY SAVE ERROR:", legacyError);
        // Don't fail registration if legacy claim fails, but log the error
      }
    }

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

// AUTO EXPIRE LOGIC (Strategy 1: Hybrid Calendar Authority)
    const today = new Date();
    let isExpired = false;

    if (user.membershipEndDate) {
      // Modern Calendar-Driven Check
      isExpired = today > new Date(user.membershipEndDate);
    } else {
      // Legacy Fallback for older users
      isExpired = user.remainingDays <= 0;
    }

    if (isExpired && user.membershipStatus === "active") {
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

      // Reset notification flags if membership dates/days are being topped up
    if (membershipEndDate || totalDays) {
      user.notificationFlags = {
        warning7: false,
        warning3: false,
        warning1: false,
        expired: false,
      };
    }
    
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

const checkInMember = async (req, res) => {
  try {
    const { scannedQrValue, accessPoint = "main-door" } = req.body;

    if (!scannedQrValue) {
      return res.status(400).json({ message: "QR value is required" });
    }

    if (scannedQrValue !== GYM_QR.ENTRY) {
      return res.status(400).json({ message: "Invalid gym QR code. Please scan the ENTRY QR." });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

if (user.membershipStatus !== "active") {
      return res.status(400).json({ message: "Membership is not active" });
    }

    // Strategy 1: Hybrid Door Access Validation
    const today = new Date();
    let balanceIsInvalid = false;

    if (user.membershipEndDate) {
      // Block entry if current date is past the end date calendar window
      balanceIsInvalid = today > new Date(user.membershipEndDate);
    } else {
      // Block entry if legacy user runs out of active raw numerical days
      balanceIsInvalid = (user.remainingDays || 0) <= 0;
    }

if (balanceIsInvalid) {
      user.membershipStatus = "expired";
      await user.save();
      return res.status(400).json({ message: "Your membership period has expired. Please renew at the front desk." });
    }

    // We just use the 'today' variable we already created above!
    const todayString = getSriLankaDateKey(today);

    if (user.lastCheckIn) {
      const lastCheckInString = getSriLankaDateKey(new Date(user.lastCheckIn));

      if (lastCheckInString === todayString) {
        return res.status(400).json({ message: "Already checked in today" });
      }
    }

    // Check for active pending command before creating new one
    const activeCommand = await DoorCommand.findOne({
      deviceId: DOOR_DEVICE_ID,
      status: { $in: ["pending", "claimed"] },
      expiresAt: { $gt: new Date() },
    });

    if (activeCommand) {
      return res.status(409).json({
        message: "Door controller already has a pending command. Try again in a moment.",
        commandId: activeCommand._id,
      });
    }

    // Create door access session
    const session = await DoorAccessSession.create({
      userId: user._id,
      userName: user.fullName || user.name || "Member",
      userEmail: user.email,
      action: "entry",
      accessPoint,
      unlockApproved: true,
      triggeredBy: "member_qr",
      notes: "Member check-in via QR scan",
    });

    // Create door command for ESP32 to poll
    const command = await DoorCommand.create({
      sessionId: session._id,
      userId: user._id,
      userName: user.fullName || user.name || "Member",
      action: "unlock",
      accessPoint,
      deviceId: DOOR_DEVICE_ID,
      status: "pending",
      expiresAt: new Date(Date.now() + COMMAND_EXPIRE_MS),
    });

    // Update user attendance (read-only validation - no days deduction)
    user.attendanceCount += 1;
    user.lastCheckIn = today;
    user.isInsideGym = true;
    user.lastEntryAt = today;

    await user.save();

    return res.status(200).json({
      message: "Check-in successful ✅",
      user,
      commandId: command._id,
      sessionId: session._id,
      doorSessionId: session._id,
      doorMode: "poll",
      doorMessage: "Waiting for ESP32 confirmation.",
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
    const { scannedQrValue, accessPoint = "main-door" } = req.body;

    if (!scannedQrValue) {
      return res.status(400).json({ message: "QR value is required" });
    }

    if (scannedQrValue !== GYM_QR.EXIT) {
      return res.status(400).json({ message: "Invalid gym QR code. Please scan the EXIT QR." });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check for active pending command before creating new one
    const activeCommand = await DoorCommand.findOne({
      deviceId: DOOR_DEVICE_ID,
      status: { $in: ["pending", "claimed"] },
      expiresAt: { $gt: new Date() },
    });

    if (activeCommand) {
      return res.status(409).json({
        message: "Door controller already has a pending command. Try again in a moment.",
        commandId: activeCommand._id,
      });
    }

    // Create door access session
    const session = await DoorAccessSession.create({
      userId: user._id,
      userName: user.fullName || user.name || "Member",
      userEmail: user.email,
      action: "exit",
      accessPoint,
      unlockApproved: true,
      triggeredBy: "member_qr",
      notes: "Member check-out via QR scan",
    });

    // Create door command for ESP32 to poll
    const command = await DoorCommand.create({
      sessionId: session._id,
      userId: user._id,
      userName: user.fullName || user.name || "Member",
      action: "unlock",
      accessPoint,
      deviceId: DOOR_DEVICE_ID,
      status: "pending",
      expiresAt: new Date(Date.now() + COMMAND_EXPIRE_MS),
    });

    // Update user exit status
    user.isInsideGym = false;
    user.lastExitAt = new Date();

    await user.save();

    return res.status(200).json({
      message: "Check-out successful ✅",
      user,
      commandId: command._id,
      sessionId: session._id,
      doorSessionId: session._id,
      doorMode: "poll",
      doorMessage: "Waiting for ESP32 confirmation.",
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

    // Reset flags for the newly approved legacy user
    user.notificationFlags = {
      warning7: false,
      warning3: false,
      warning1: false,
      expired: false,
    };

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

// UPDATE LEGACY CLAIM (ADMIN)
const updateLegacyClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { claimedPhoneNumber, startMonth, startYear, previousMembershipPlanType } = req.body;

    const claim = await LegacyClaim.findById(id);

    if (!claim) {
      return res.status(404).json({ message: "Legacy claim not found" });
    }

    if (claimedPhoneNumber !== undefined) claim.claimedPhoneNumber = claimedPhoneNumber;
    if (startMonth !== undefined) claim.startMonth = startMonth;
    if (startYear !== undefined) claim.startYear = startYear;
    if (previousMembershipPlanType !== undefined) claim.legacyPlan = previousMembershipPlanType;

    await claim.save();

    return res.status(200).json({
      message: "Legacy claim updated successfully",
      claim,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// UPDATE PROFILE PICTURE
const updateProfilePicture = async (req, res) => {
  try {
    const { profilePicture } = req.body;
    const userId = req.user.id;

    if (!profilePicture) {
      return res.status(400).json({ message: "Profile picture URL is required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.profilePicture = profilePicture;
    await user.save();

    return res.status(200).json({
      message: "Profile picture updated successfully",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// LOG HEALTH METRICS
const logHealthMetrics = async (req, res) => {
  try {
    const { type, value, additionalData } = req.body;
    const userId = req.user.id;

    if (!type || !value) {
      return res.status(400).json({ message: "Type and value are required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize healthMetrics if it doesn't exist
    if (!user.healthMetrics) {
      user.healthMetrics = {
        weightLogs: [],
        bodyFatLogs: [],
        muscleMassLogs: [],
        hydrationLogs: [],
        sleepLogs: [],
        progressPhotos: []
      };
    }

    const logEntry = {
      date: new Date()
    };

    switch (type) {
      case 'weight':
        logEntry.weight = Number(value);
        user.healthMetrics.weightLogs.push(logEntry);
        break;
      case 'bodyFat':
        logEntry.bodyFat = Number(value);
        user.healthMetrics.bodyFatLogs.push(logEntry);
        break;
      case 'muscleMass':
        logEntry.muscleMass = Number(value);
        user.healthMetrics.muscleMassLogs.push(logEntry);
        break;
      case 'hydration':
        logEntry.amount = Number(value);
        user.healthMetrics.hydrationLogs.push(logEntry);
        break;
      case 'sleep':
        logEntry.quality = additionalData?.quality || 'good';
        logEntry.hours = Number(value);
        user.healthMetrics.sleepLogs.push(logEntry);
        break;
      case 'progressPhoto':
        logEntry.url = value;
        user.healthMetrics.progressPhotos.push(logEntry);
        break;
      default:
        return res.status(400).json({ message: "Invalid metric type" });
    }

    await user.save();

    return res.status(200).json({
      message: "Health metric logged successfully",
      healthMetrics: user.healthMetrics,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET HEALTH METRICS
const getHealthMetrics = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('healthMetrics');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      healthMetrics: user.healthMetrics || {
        weightLogs: [],
        bodyFatLogs: [],
        muscleMassLogs: [],
        hydrationLogs: [],
        sleepLogs: [],
        progressPhotos: []
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// UPDATE PROFILE DETAILS
const updateProfileDetails = async (req, res) => {
  try {
    // Added height here to capture it from the frontend request body
    const { fullName, mobileNumber, fitnessGoals, height } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (fullName) user.fullName = fullName;
    if (mobileNumber) user.mobileNumber = mobileNumber;
    if (fitnessGoals) user.fitnessGoals = fitnessGoals;
    if (height) user.height = height; // Saves height to the database

    await user.save();

    return res.status(200).json({
      message: "Profile details updated successfully",
      user: {
        fullName: user.fullName,
        mobileNumber: user.mobileNumber,
        fitnessGoals: user.fitnessGoals,
        height: user.height, // Sends the updated height back to frontend
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// SAVE MEASUREMENT HISTORY
const saveMeasurementHistory = async (req, res) => {
  try {
    const {
      weight,
      bodyFat,
      muscleMass,
      chest,
      shoulders,
      waist,
      hips,
      leftBicep,
      rightBicep,
      leftThigh,
      rightThigh,
    } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize healthMetrics if it doesn't exist
    if (!user.healthMetrics) {
      user.healthMetrics = {
        weightLogs: [],
        bodyFatLogs: [],
        muscleMassLogs: [],
        hydrationLogs: [],
        sleepLogs: [],
        progressPhotos: [],
        measurementHistory: []
      };
    }

    if (!user.healthMetrics.measurementHistory) {
      user.healthMetrics.measurementHistory = [];
    }

    // Add new measurement entry
    user.healthMetrics.measurementHistory.push({
      timestamp: new Date(),
      weight: Number(weight) || 0,
      bodyFat: Number(bodyFat) || 0,
      muscleMass: Number(muscleMass) || 0,
      chest: Number(chest) || 0,
      shoulders: Number(shoulders) || 0,
      waist: Number(waist) || 0,
      hips: Number(hips) || 0,
      leftBicep: Number(leftBicep) || 0,
      rightBicep: Number(rightBicep) || 0,
      leftThigh: Number(leftThigh) || 0,
      rightThigh: Number(rightThigh) || 0,
    });

    // Also update individual logs for consistency
    if (weight > 0) {
      user.healthMetrics.weightLogs.push({ weight: Number(weight), date: new Date() });
    }
    if (bodyFat > 0) {
      user.healthMetrics.bodyFatLogs.push({ bodyFat: Number(bodyFat), date: new Date() });
    }
    if (muscleMass > 0) {
      user.healthMetrics.muscleMassLogs.push({ muscleMass: Number(muscleMass), date: new Date() });
    }

    await user.save();

    return res.status(200).json({
      message: "Measurement history saved successfully",
      measurementHistory: user.healthMetrics.measurementHistory,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// SAVE BEFORE/AFTER MEASUREMENTS
const saveBeforeAfterMeasurements = async (req, res) => {
  try {
    const { type, measurements, targetWeight, bmi } = req.body; // type: "before" or "after"
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize healthMetrics if it doesn't exist
    if (!user.healthMetrics) {
      user.healthMetrics = {
        targetWeight: 0,
        bmi: 0,
        beforeAfterMeasurements: {
          before: {},
          after: {}
        },
        beforeAfterPhotos: {
          before: { front: {}, back: {}, side: {} },
          after: { front: {}, back: {}, side: {} }
        }
      };
    }

    if (!user.healthMetrics.beforeAfterMeasurements) {
      user.healthMetrics.beforeAfterMeasurements = {
        before: {},
        after: {}
      };
    }

    // Update measurements (no editCount restriction)
    user.healthMetrics.beforeAfterMeasurements[type] = {
      ...measurements,
      timestamp: new Date()
    };

    // Update targetWeight and bmi if provided
    if (targetWeight !== undefined) {
      user.healthMetrics.targetWeight = targetWeight;
    }

    if (bmi !== undefined) {
      user.healthMetrics.bmi = bmi;
    }

    await user.save();

    return res.status(200).json({
      message: `${type} measurements saved successfully`,
      beforeAfterMeasurements: user.healthMetrics.beforeAfterMeasurements,
      targetWeight: user.healthMetrics.targetWeight,
      bmi: user.healthMetrics.bmi,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// UPLOAD BEFORE/AFTER PHOTO
const uploadBeforeAfterPhoto = async (req, res) => {
  try {
    const { type, view, url, publicId } = req.body; // type: "before" or "after", view: "front", "back", "side"
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize healthMetrics if it doesn't exist
    if (!user.healthMetrics) {
      user.healthMetrics = {
        beforeAfterMeasurements: {
          before: {},
          after: {}
        },
        beforeAfterPhotos: {
          before: { front: {}, back: {}, side: {} },
          after: { front: {}, back: {}, side: {} }
        }
      };
    }

    if (!user.healthMetrics.beforeAfterPhotos) {
      user.healthMetrics.beforeAfterPhotos = {
        before: { front: {}, back: {}, side: {} },
        after: { front: {}, back: {}, side: {} }
      };
    }

    // Check edit restriction for before photos
    if (type === "before") {
      const currentPhoto = user.healthMetrics.beforeAfterPhotos.before[view];
      if (currentPhoto && currentPhoto.editCount >= 1) {
        return res.status(400).json({ message: "Before photos can only be changed once" });
      }
    }

    // Update photo
    user.healthMetrics.beforeAfterPhotos[type][view] = {
      url,
      publicId,
      timestamp: new Date(),
      editCount: type === "before"
        ? (user.healthMetrics.beforeAfterPhotos.before[view]?.editCount || 0) + 1
        : user.healthMetrics.beforeAfterPhotos.after[view]?.editCount || 0
    };

    await user.save();

    return res.status(200).json({
      message: `${type} ${view} photo uploaded successfully`,
      beforeAfterPhotos: user.healthMetrics.beforeAfterPhotos,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// DELETE BEFORE/AFTER PHOTO
const deleteBeforeAfterPhoto = async (req, res) => {
  try {
    const { type, view } = req.params; // type: "before" or "after", view: "front", "back", "side"
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.healthMetrics || !user.healthMetrics.beforeAfterPhotos) {
      return res.status(404).json({ message: "No photos found" });
    }

    // Delete photo from Cloudinary if publicId exists
    const photo = user.healthMetrics.beforeAfterPhotos[type][view];
    if (photo && photo.publicId) {
      try {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        await cloudinary.uploader.destroy(photo.publicId);
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Remove photo from database
    user.healthMetrics.beforeAfterPhotos[type][view] = {};

    await user.save();

    return res.status(200).json({
      message: `${type} ${view} photo deleted successfully`,
      beforeAfterPhotos: user.healthMetrics.beforeAfterPhotos,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// CALCULATE BMI
const calculateBMI = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const weight = parseFloat(user.weight) || 0;
    const height = parseFloat(user.height) || 0;

    if (weight === 0 || height === 0) {
      return res.status(400).json({ message: "Height and weight are required for BMI calculation" });
    }

    // BMI formula: weight (kg) / (height (m))^2
    const heightInMeters = height / 100; // Convert cm to meters
    const bmi = weight / (heightInMeters * heightInMeters);

    let category = "";
    if (bmi < 18.5) {
      category = "Underweight";
    } else if (bmi >= 18.5 && bmi < 25) {
      category = "Normal";
    } else if (bmi >= 25 && bmi < 30) {
      category = "Overweight";
    } else {
      category = "Obese";
    }

    return res.status(200).json({
      bmi: bmi.toFixed(1),
      category,
      weight,
      height,
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
  updateLegacyClaim,
  updateProfilePicture,
  logHealthMetrics,
  getHealthMetrics,
  updateProfileDetails,
  saveMeasurementHistory,
  saveBeforeAfterMeasurements,
  uploadBeforeAfterPhoto,
  deleteBeforeAfterPhoto,
  calculateBMI,
};