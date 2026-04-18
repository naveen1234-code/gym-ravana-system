const User = require("../models/User");
const AccessLog = require("../models/AccessLog");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const generateApplicationPdf = require("../utils/generateApplicationPdf");
const sendAdminNotificationEmail = require("../utils/sendAdminNotificationEmail");
const GYM_QR = require("../config/gymQr");
const createNotification = require("../utils/createNotification");
const sendSMS = require("../utils/sendSMS");
const triggerDoorOpen = require("../utils/triggerDoorOpen");
const DoorAccessSession = require("../models/DoorAccessSession");
const DoorCommand = require("../models/DoorCommand");

const SRI_LANKA_TZ = "Asia/Colombo";

const getSriLankaDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SRI_LANKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
};

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
  memberSignature,
  turnstileToken,
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

    if (!memberSignature || memberSignature.trim() === "") {
      return res.status(400).json({ message: "Member signature is required" });
    }

    if (!turnstileToken || turnstileToken.trim() === "") {
  return res.status(400).json({ message: "Bot protection is required" });
}

const turnstileRes = await fetch(
  "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  }
);

const turnstileData = await turnstileRes.json();

if (!turnstileData.success) {
  return res.status(400).json({
    message: "Bot protection verification failed",
  });
}

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: fullName,
      email,
      password: hashedPassword,

      membershipNo: membershipNo || "",
      date: date || "",

      powerTraining: !!powerTraining,
      fatBurning: !!fatBurning,
      zumba: !!zumba,
      yoga: !!yoga,

      nicPassport: nicPassport || "",
      age: age || "",
      fullName: fullName || "",
      title: title || "",
      birthDay: birthDay || "",
      birthMonth: birthMonth || "",
      birthYear: birthYear || "",
      sex: sex || "",

      address: address || "",
      homeNumber: homeNumber || "",
      mobileNumber: mobileNumber || "",
      facebookId: facebookId || "",
      instaId: instaId || "",

      company: company || "",
      profession: profession || "",

      weight: weight || "",
      height: height || "",
      medicalNotes: medicalNotes || "",

      payment: payment || "",
      memberSignature: memberSignature || "",
    });

    const pdfResult = await generateApplicationPdf(user);

    user.applicationPdfUrl = pdfResult.publicUrl;
    user.applicationSubmittedAt = new Date();
    await user.save();

    await createNotification({
      audience: "admin",
      type: "new_registration",
      title: "New Member Registration",
      message: `${user.fullName || user.name} has submitted a new membership application.`,
      metadata: {
        userId: user._id,
        email: user.email,
        applicationPdfUrl: user.applicationPdfUrl,
      },
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "registration_success",
      title: "Registration Successful",
      message: "Your membership application has been submitted successfully.",
      metadata: {
        applicationPdfUrl: user.applicationPdfUrl,
      },
    });

    try {
      if (process.env.ADMIN_MOBILE_NUMBER) {
        await sendSMS({
          phone: process.env.ADMIN_MOBILE_NUMBER,
          message: `Gym Ravana: New registration from ${user.fullName || user.name}. Email: ${user.email}.`,
        });
      }
    } catch (smsError) {
      console.error("NEW REGISTRATION ADMIN SMS ERROR:", smsError.message);
    }

    try {
      await sendAdminNotificationEmail({
        subject: `New Gym Registration - ${user.fullName || user.name}`,
        html: `
          <h2>New Member Registration</h2>
          <p><strong>Name:</strong> ${user.fullName || user.name}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Membership No:</strong> ${user.membershipNo || "N/A"}</p>
          <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
          <br />
          <p>The completed application PDF is attached to this email.</p>
        `,
        attachments: [
          {
            filename: pdfResult.fileName,
            path: pdfResult.filePath,
          },
        ],
      });
    } catch (emailError) {
      console.error("ADMIN EMAIL SEND ERROR:", emailError.message);
    }

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        applicationPdfUrl: user.applicationPdfUrl,
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
      return res.status(400).json({ message: "Please enter email and password" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

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

    if (user.remainingDays <= 0 && user.membershipStatus === "active") {
      user.membershipStatus = "expired";
      await user.save();

      await createNotification({
        audience: "admin",
        type: "membership_expired",
        title: "Membership Expired",
        message: `${user.fullName || user.name} membership has expired.`,
        metadata: {
          userId: user._id,
          email: user.email,
        },
      });

      await createNotification({
        userId: user._id,
        audience: "member",
        type: "membership_expired",
        title: "Membership Expired",
        message: "Your membership has expired. Please renew to continue access.",
        metadata: {},
      });
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

    const previousStatus = user.membershipStatus;
    const previousPlan = user.membershipPlan;
    const previousRemainingDays = user.remainingDays;

    user.membershipStatus =
      membershipStatus !== undefined ? membershipStatus : user.membershipStatus;

    user.membershipPlan =
      membershipPlan !== undefined ? membershipPlan : user.membershipPlan;

    user.membershipStartDate =
      membershipStartDate !== undefined
        ? membershipStartDate
        : user.membershipStartDate;

    user.membershipEndDate =
      membershipEndDate !== undefined
        ? membershipEndDate
        : user.membershipEndDate;

    if (totalDays !== undefined && totalDays !== null) {
      if (Number.isNaN(Number(totalDays)) || Number(totalDays) < 0) {
        return res.status(400).json({ message: "Invalid totalDays value" });
      }
      user.totalDays = Number(totalDays);
    }

    if (remainingDays !== undefined && remainingDays !== null) {
      if (Number.isNaN(Number(remainingDays)) || Number(remainingDays) < 0) {
        return res.status(400).json({ message: "Invalid remainingDays value" });
      }
      user.remainingDays = Number(remainingDays);
    }

    const isFreshActivation =
      previousStatus !== "active" && user.membershipStatus === "active";

    const isPlanOrCycleReset =
      previousPlan !== user.membershipPlan ||
      previousRemainingDays !== user.remainingDays;

    if (isFreshActivation || (user.membershipStatus === "active" && isPlanOrCycleReset)) {
      user.lastDayDeductedAt = null;
      user.lastCheckIn = null;
      user.isInsideGym = false;
      user.lastEntryAt = null;
      user.lastExitAt = null;

      if (!user.notificationFlags) {
        user.notificationFlags = {
          warning7: false,
          warning3: false,
          warning1: false,
          expired: false,
        };
      } else {
        user.notificationFlags.warning7 = false;
        user.notificationFlags.warning3 = false;
        user.notificationFlags.warning1 = false;
        user.notificationFlags.expired = false;
      }
    }

    if (user.remainingDays <= 0 && user.membershipStatus === "active") {
      user.membershipStatus = "expired";
    }

    await user.save();

    if (previousStatus !== user.membershipStatus) {
      if (user.membershipStatus === "active") {
        await createNotification({
          audience: "admin",
          type: "membership_activated",
          title: "Membership Activated",
          message: `${user.fullName || user.name} membership has been activated.`,
          metadata: {
            userId: user._id,
            membershipPlan: user.membershipPlan,
          },
        });

        await createNotification({
          userId: user._id,
          audience: "member",
          type: "membership_activated",
          title: "Membership Activated",
          message: `Your membership is now active under the ${user.membershipPlan || "selected"} plan.`,
          metadata: {
            membershipPlan: user.membershipPlan,
            membershipEndDate: user.membershipEndDate,
          },
        });
      }

      if (user.membershipStatus === "expired") {
        await createNotification({
          audience: "admin",
          type: "membership_expired",
          title: "Membership Expired",
          message: `${user.fullName || user.name} membership has been marked as expired.`,
          metadata: {
            userId: user._id,
          },
        });

        await createNotification({
          userId: user._id,
          audience: "member",
          type: "membership_expired",
          title: "Membership Expired",
          message: "Your membership has expired. Please renew to continue access.",
          metadata: {},
        });
      }
    }

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

// CHECK-IN MEMBER (ENTRY)
// CHECK-IN MEMBER (ENTRY)
const checkInMember = async (req, res) => {
  try {
    const { scannedQrValue, accessPoint = "main-door" } = req.body;

    if (!scannedQrValue) {
      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "QR value is required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "User not found",
      });
    }

    if (scannedQrValue !== GYM_QR.ENTRY) {
      await AccessLog.create({
        userId: user._id,
        userName: user.fullName || user.name,
        userEmail: user.email,
        action: "entry",
        result: "denied",
        reason: "Invalid ENTRY QR code",
        accessPoint,
        doorTriggered: false,
        doorMode: process.env.DOOR_MODE || "mock",
      });

      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "Invalid entry QR code",
      });
    }

    if (user.isInsideGym) {
      await AccessLog.create({
        userId: user._id,
        userName: user.fullName || user.name,
        userEmail: user.email,
        action: "entry",
        result: "denied",
        reason: "User is already inside",
        accessPoint,
        doorTriggered: false,
        doorMode: process.env.DOOR_MODE || "mock",
      });

      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "You are already inside the gym",
      });
    }

    if (user.membershipStatus !== "active") {
      await AccessLog.create({
        userId: user._id,
        userName: user.fullName || user.name,
        userEmail: user.email,
        action: "entry",
        result: "denied",
        reason: "Membership is not active",
        accessPoint,
        doorTriggered: false,
        doorMode: process.env.DOOR_MODE || "mock",
      });

      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "Membership is not active",
      });
    }

    if (user.remainingDays <= 0) {
      user.membershipStatus = "expired";
      await user.save();

      await createNotification({
        audience: "admin",
        type: "membership_expired",
        title: "Membership Expired",
        message: `${user.fullName || user.name} has no remaining days left.`,
        metadata: {
          userId: user._id,
        },
      });

      await createNotification({
        userId: user._id,
        audience: "member",
        type: "membership_expired",
        title: "Membership Expired",
        message: "You have no remaining days left on your membership.",
        metadata: {},
      });

      await AccessLog.create({
        userId: user._id,
        userName: user.fullName || user.name,
        userEmail: user.email,
        action: "entry",
        result: "denied",
        reason: "No remaining days left",
        accessPoint,
        doorTriggered: false,
        doorMode: process.env.DOOR_MODE || "mock",
      });

      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "No remaining days left",
      });
    }

    const today = new Date();
    const todayKey = getSriLankaDateKey(today);

    if (user.lastCheckIn) {
      const lastCheckInKey = getSriLankaDateKey(user.lastCheckIn);

      if (lastCheckInKey === todayKey) {
        await AccessLog.create({
          userId: user._id,
          userName: user.fullName || user.name,
          userEmail: user.email,
          action: "entry",
          result: "denied",
          reason: "Already checked in today",
          accessPoint,
          doorTriggered: false,
          doorMode: process.env.DOOR_MODE || "mock",
        });

        return res.status(400).json({
          success: false,
          accessGranted: false,
          doorOpened: false,
          message: "Already checked in today",
        });
      }
    }

    const alreadyDeductedToday =
      user.lastDayDeductedAt &&
      getSriLankaDateKey(user.lastDayDeductedAt) === todayKey;

    user.attendanceCount = (user.attendanceCount || 0) + 1;

    if (!alreadyDeductedToday) {
      user.remainingDays = Math.max((user.remainingDays || 0) - 1, 0);
      user.lastDayDeductedAt = today;
    }

    user.lastCheckIn = today;
    user.lastEntryAt = today;
    user.isInsideGym = true;

    if (user.remainingDays <= 0) {
      user.membershipStatus = "expired";
    }

    await user.save();

await DoorCommand.create({
  sessionId: doorSession._id,
  userId: user._id,
  userName: user.fullName || user.name,
  action: "unlock",
  accessPoint,
  deviceId: "main-door-controller",
  status: "pending",
  expiresAt: new Date(Date.now() + 30000),
});

const doorResult = {
  success: true,
  mode: "poll",
  message: "Door unlock command queued successfully",
};

    await AccessLog.create({
      userId: user._id,
      userName: user.fullName || user.name,
      userEmail: user.email,
      action: "entry",
      result: "granted",
      reason: "Entry granted",
      accessPoint,
      doorTriggered: doorResult.success,
      doorMode: doorResult.mode,
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "check_in_success",
      title: "Check-In Successful",
      message: `You entered successfully. Remaining days: ${user.remainingDays}`,
      metadata: {
        remainingDays: user.remainingDays,
        attendanceCount: user.attendanceCount,
        accessPoint,
        doorOpened: doorResult.success,
        doorSessionId: doorSession._id,
      },
    });

    if (user.membershipStatus === "expired") {
      await createNotification({
        audience: "admin",
        type: "membership_expired",
        title: "Membership Expired",
        message: `${user.fullName || user.name} membership expired after entry.`,
        metadata: {
          userId: user._id,
        },
      });

      await createNotification({
        userId: user._id,
        audience: "member",
        type: "membership_expired",
        title: "Membership Expired",
        message: "Your membership has expired after today’s entry.",
        metadata: {},
      });
    }

    return res.status(200).json({
      success: true,
      accessGranted: true,
      doorOpened: doorResult.success,
      doorMode: doorResult.mode,
      doorMessage: doorResult.message,
      doorSessionId: doorSession._id,
      action: "entry",
      isInside: user.isInsideGym,
      isInsideGym: user.isInsideGym,
      message: "Entry successful ✅",
      user,
    });
  } catch (error) {
    console.error("CHECK-IN ERROR:", error);

    return res.status(500).json({
      success: false,
      accessGranted: false,
      doorOpened: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// CHECK-OUT MEMBER (EXIT)
const checkOutMember = async (req, res) => {
  try {
    const { scannedQrValue, accessPoint = "main-door" } = req.body;

    if (!scannedQrValue) {
      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "QR value is required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "User not found",
      });
    }

    if (scannedQrValue !== GYM_QR.EXIT) {
      await AccessLog.create({
        userId: user._id,
        userName: user.fullName || user.name,
        userEmail: user.email,
        action: "exit",
        result: "denied",
        reason: "Invalid EXIT QR code",
        accessPoint,
        doorTriggered: false,
        doorMode: process.env.DOOR_MODE || "mock",
      });

      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "Invalid exit QR code",
      });
    }

    if (!user.isInsideGym) {
      await AccessLog.create({
        userId: user._id,
        userName: user.fullName || user.name,
        userEmail: user.email,
        action: "exit",
        result: "denied",
        reason: "User is not currently inside",
        accessPoint,
        doorTriggered: false,
        doorMode: process.env.DOOR_MODE || "mock",
      });

      return res.status(400).json({
        success: false,
        accessGranted: false,
        doorOpened: false,
        message: "You are not currently inside the gym",
      });
    }

    user.isInsideGym = false;
    user.lastExitAt = new Date();
    await user.save();

await DoorCommand.create({
  sessionId: doorSession._id,
  userId: user._id,
  userName: user.fullName || user.name,
  action: "unlock",
  accessPoint,
  deviceId: "main-door-controller",
  status: "pending",
  expiresAt: new Date(Date.now() + 30000),
});

const doorResult = {
  success: true,
  mode: "poll",
  message: "Door unlock command queued successfully",
}; 

    await AccessLog.create({
      userId: user._id,
      userName: user.fullName || user.name,
      userEmail: user.email,
      action: "exit",
      result: "granted",
      reason: "Exit granted",
      accessPoint,
      doorTriggered: doorResult.success,
      doorMode: doorResult.mode,
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "check_out_success",
      title: "Check-Out Successful",
      message: "You checked out successfully.",
      metadata: {
        accessPoint,
        doorOpened: doorResult.success,
        doorSessionId: doorSession._id,
      },
    });

    return res.status(200).json({
      success: true,
      accessGranted: true,
      doorOpened: doorResult.success,
      doorMode: doorResult.mode,
      doorMessage: doorResult.message,
      doorSessionId: doorSession._id,
      action: "exit",
      isInside: user.isInsideGym,
      isInsideGym: user.isInsideGym,
      message: "Exit successful ✅",
      user,
    });
  } catch (error) {
    console.error("CHECK-OUT ERROR:", error);

    return res.status(500).json({
      success: false,
      accessGranted: false,
      doorOpened: false,
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

    await sendAdminNotificationEmail({
      to: user.email,
      subject: "GYM RAVANA Password Reset",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #0b0b0b; color: #ffffff;">
          <h1 style="color: #ff3b30;">GYM RAVANA</h1>
          <p>You requested a password reset.</p>
          <p>Click the button below to reset your password:</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" style="background:#ff3b30;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold;">
              Reset Password
            </a>
          </p>
          <p>If you did not request this, you can ignore this email.</p>
          <p style="margin-top:20px;color:#999;">This link expires in 30 minutes.</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: "Password reset link sent successfully",
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
    await sendAdminNotificationEmail({
      subject: "GYM RAVANA TEST EMAIL ✅",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #0b0b0b; color: #ffffff;">
          <h1 style="color: #ff3b30;">GYM RAVANA</h1>
          <p>This is a <b>test email</b> from your Gym Ravana system.</p>
          <p>If you received this, your Gmail setup is working correctly ✅</p>
          <hr style="border-color: #333;" />
          <p style="font-size: 14px; color: #aaa;">System test by Zyverion</p>
        </div>
      `,
    });

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
    const ok = await sendSMS({
      phone: "0750523127",
      message: "Gym Ravana test SMS working ✅",
    });

    return res.status(200).json({
      message: ok
        ? "Test SMS sent successfully ✅"
        : "SMS provider not configured yet",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Test SMS failed ❌",
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
};