const AccessLog = require("../models/AccessLog");
const User = require("../models/User");
const DoorAccessSession = require("../models/DoorAccessSession");
const createNotification = require("../utils/createNotification");
const triggerDoorOpen = require("../utils/triggerDoorOpen");
const DoorCommand = require("../models/DoorCommand");

// GET ALL ACCESS LOGS
const getAccessLogs = async (req, res) => {
  try {
    const logs = await AccessLog.find().sort({ createdAt: -1 });

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch access logs",
      error: error.message,
    });
  }
};

// GET MEMBERS CURRENTLY INSIDE
const getInsideMembers = async (req, res) => {
  try {
    const insideMembers = await User.find({
      isInsideGym: true,
      role: "member",
    }).select("-password");

    return res.status(200).json(insideMembers);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch inside members",
      error: error.message,
    });
  }
};

// GET ACCESS STATS
const getAccessStats = async (req, res) => {
  try {
    const totalLogs = await AccessLog.countDocuments();
    const grantedLogs = await AccessLog.countDocuments({ result: "granted" });
    const deniedLogs = await AccessLog.countDocuments({ result: "denied" });
    const entryLogs = await AccessLog.countDocuments({ action: "entry" });
    const exitLogs = await AccessLog.countDocuments({ action: "exit" });

    const insideNow = await User.countDocuments({
      isInsideGym: true,
      role: "member",
    });

    const lastGranted = await AccessLog.findOne({ result: "granted" }).sort({
      createdAt: -1,
    });

    const lastDenied = await AccessLog.findOne({ result: "denied" }).sort({
      createdAt: -1,
    });

    const latestActivity = await AccessLog.find().sort({ createdAt: -1 }).limit(10);

    return res.status(200).json({
      totalLogs,
      grantedLogs,
      deniedLogs,
      entryLogs,
      exitLogs,
      insideNow,
      lastGrantedAt: lastGranted ? lastGranted.createdAt : null,
      lastDeniedAt: lastDenied ? lastDenied.createdAt : null,
      latestActivity,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch access stats",
      error: error.message,
    });
  }
};

// ADMIN FORCE EXIT MEMBER
const forceExitMember = async (req, res) => {
  try {
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role !== "member") {
      return res.status(400).json({
        message: "Only members can be force exited",
      });
    }

    if (!user.isInsideGym) {
      return res.status(400).json({
        message: "Member is already outside",
      });
    }

    const forcedExitTime = new Date();

    user.isInsideGym = false;
    user.lastExitAt = forcedExitTime;
    await user.save();

    await AccessLog.create({
      userId: user._id,
      userName: user.fullName || user.name,
      userEmail: user.email,
      action: "exit",
      result: "granted",
      reason: reason?.trim()
        ? `Admin force exit: ${reason.trim()}`
        : "Admin force exit",
      accessPoint: "admin-dashboard",
      doorTriggered: false,
      doorMode: "manual",
      scanMethod: "admin-force-exit",
    });

    return res.status(200).json({
      message: "Member force exited successfully",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to force exit member",
      error: error.message,
    });
  }
};

const deviceDoorOpened = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        message: "Session ID is required",
      });
    }

    const session = await DoorAccessSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        message: "Door access session not found",
      });
    }

    session.doorOpened = true;
    session.openedAt = new Date();
    await session.save();

    return res.status(200).json({
      message: "Door open event recorded",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to record door open event",
      error: error.message,
    });
  }
};

const deviceDoorClosed = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        message: "Session ID is required",
      });
    }

    const session = await DoorAccessSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        message: "Door access session not found",
      });
    }

    session.doorClosed = true;
    session.closedAt = new Date();
    session.completed = true;
    session.completedAt = new Date();
    await session.save();

    await createNotification({
      audience: "admin",
      type: "door_session_completed",
      title: "Door Session Completed",
      message: `${session.userName} completed ${session.action} at ${session.accessPoint}.`,
      metadata: {
        sessionId: session._id,
        userId: session.userId,
        action: session.action,
        accessPoint: session.accessPoint,
      },
    });

    return res.status(200).json({
      message: "Door close event recorded",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to record door close event",
      error: error.message,
    });
  }
};

const manualUnlockEvent = async (req, res) => {
  try {
    const {
      userId,
      accessPoint = "main-door",
      notes = "Manual unlock button used",
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const session = await DoorAccessSession.create({
      userId: user._id,
      userName: user.fullName || user.name,
      userEmail: user.email,
      action: "manual",
      accessPoint,
      unlockApproved: true,
      triggeredBy: "manual_button",
      notes,
    });

    const doorResult = await triggerDoorOpen({
      sessionId: session._id.toString(),
      userId: user._id.toString(),
      userName: user.fullName || user.name,
      accessPoint,
      action: "unlock",
    });

    await AccessLog.create({
      userId: user._id,
      userName: user.fullName || user.name,
      userEmail: user.email,
      action: user.isInsideGym ? "exit" : "entry",
      result: "granted",
      reason: notes,
      accessPoint,
      doorTriggered: doorResult.success,
      doorMode: doorResult.mode,
      scanMethod: "manual-button",
    });

    await createNotification({
      audience: "admin",
      type: "manual_unlock_used",
      title: "Manual Unlock Used",
      message: `${user.fullName || user.name} triggered manual unlock at ${accessPoint}.`,
      metadata: {
        sessionId: session._id,
        userId: user._id,
        accessPoint,
        doorOpened: doorResult.success,
        doorMode: doorResult.mode,
      },
    });

    return res.status(200).json({
      message: "Manual unlock recorded successfully",
      session,
      doorOpened: doorResult.success,
      doorMode: doorResult.mode,
      doorMessage: doorResult.message,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to record manual unlock",
      error: error.message,
    });
  }
};

const devicePollCommand = async (req, res) => {
  try {
    const { deviceId = "main-door-controller" } = req.body || {};

    const now = new Date();

    const command = await DoorCommand.findOneAndUpdate(
      {
        deviceId,
        status: "pending",
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status: "claimed",
          claimedAt: now,
        },
      },
      {
        new: true,
        sort: { createdAt: 1 },
      }
    );

    if (!command) {
      return res.status(200).json({
        success: true,
        command: null,
      });
    }

    return res.status(200).json({
      success: true,
      command: {
        id: command._id,
        action: command.action,
        sessionId: command.sessionId,
        userId: command.userId,
        userName: command.userName,
        accessPoint: command.accessPoint,
        deviceId: command.deviceId,
        createdAt: command.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to poll door command",
      error: error.message,
    });
  }
};

module.exports = {
  getAccessLogs,
  getInsideMembers,
  getAccessStats,
  deviceDoorOpened,
  deviceDoorClosed,
  manualUnlockEvent,
  forceExitMember,
  devicePollCommand,
};