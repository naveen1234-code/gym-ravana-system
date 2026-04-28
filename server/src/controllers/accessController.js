const AccessLog = require("../models/AccessLog");
const User = require("../models/User");
const DoorAccessSession = require("../models/DoorAccessSession");
const DoorCommand = require("../models/DoorCommand");
const createNotification = require("../utils/createNotification");
const DoorDeviceStatus = require("../models/DoorDeviceStatus");

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

    const latestActivity = await AccessLog.find()
      .sort({ createdAt: -1 })
      .limit(10);

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

    await DoorCommand.findOneAndUpdate(
      { sessionId: session._id },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
        },
      }
    );

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
      accessPoint = "main-door",
      notes = "Admin remote unlock button used",
    } = req.body || {};

    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        message: "Admin authentication is required",
      });
    }

    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin user not found",
      });
    }

    const session = await DoorAccessSession.create({
      userId: admin._id,
      userName: admin.fullName || admin.name || "Admin",
      userEmail: admin.email,
      action: "manual",
      accessPoint,
      unlockApproved: true,
      triggeredBy: "admin_override",
      notes,
    });

    await DoorCommand.create({
      sessionId: session._id,
      userId: admin._id,
      userName: admin.fullName || admin.name || "Admin",
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
      userId: admin._id,
      userName: admin.fullName || admin.name || "Admin",
      userEmail: admin.email,
      action: "entry",
      result: "granted",
      reason: notes,
      accessPoint,
      doorTriggered: doorResult.success,
      doorMode: doorResult.mode,
      scanMethod: "admin-remote-door-app",
    });

    await createNotification({
      audience: "admin",
      type: "manual_unlock_used",
      title: "Remote Door Unlock Used",
      message: `${admin.fullName || admin.name || "Admin"} remotely unlocked ${accessPoint}.`,
      metadata: {
        sessionId: session._id,
        adminId: admin._id,
        accessPoint,
        doorMode: doorResult.mode,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Remote door unlock queued successfully",
      session,
      doorOpened: doorResult.success,
      doorMode: doorResult.mode,
      doorMessage: doorResult.message,
    });
} catch (error) {
  console.error("REMOTE DOOR UNLOCK ERROR:", error);

  return res.status(500).json({
    success: false,
    message: "Failed to queue remote door unlock",
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

const getDoorLiveState = async (req, res) => {
  try {
    const deviceId = "main-door-controller";
    const now = new Date();
    const offlineAfterMs = 10000;

    const deviceStatus = await DoorDeviceStatus.findOne({ deviceId });

    const latestSession = await DoorAccessSession.findOne({
      accessPoint: "main-door",
    }).sort({ createdAt: -1 });

    const latestCommand = await DoorCommand.findOne({
      deviceId,
    }).sort({ createdAt: -1 });

    const hasHeartbeat =
      deviceStatus?.lastHeartbeatAt &&
      now.getTime() - new Date(deviceStatus.lastHeartbeatAt).getTime() <= offlineAfterMs;

    if (!deviceStatus || !hasHeartbeat) {
      return res.status(200).json({
        success: true,
        state: "HARDWARE_OFFLINE",
        color: "gray",
        isUnlocked: false,
        hardwareOnline: false,
        message: "Door hardware is offline or not powered.",
        device: deviceStatus || null,
        session: latestSession || null,
        command: latestCommand || null,
      });
    }

    let state = deviceStatus.state || "UNKNOWN";
    let color = "red";
    let isUnlocked = false;
    let message = "Door is locked.";

    if (state === "LOCKED") {
      color = "red";
      isUnlocked = false;
      message = "Door is locked.";
    }

    if (state === "UNLOCKED_WAITING_FOR_FIRST_OPEN") {
      color = "green";
      isUnlocked = true;
      message = "Door is unlocked. Waiting for door to open.";
    }

    if (state === "DOOR_OPEN") {
      color = "green";
      isUnlocked = true;
      message = "Door is open / unlocked.";
    }

    if (state === "WAITING_TO_RELOCK") {
      color = "green";
      isUnlocked = true;
      message = "Door is closed and relocking soon.";
    }

    if (
      latestCommand &&
      latestCommand.status === "pending" &&
      state === "LOCKED"
    ) {
      state = "UNLOCK_PENDING";
      color = "orange";
      isUnlocked = false;
      message = "Unlock command is waiting for ESP32.";
    }

    return res.status(200).json({
      success: true,
      state,
      color,
      isUnlocked,
      hardwareOnline: true,
      message,
      device: {
        deviceId: deviceStatus.deviceId,
        ip: deviceStatus.ip,
        state: deviceStatus.state,
        doorClosed: deviceStatus.doorClosed,
        doorOpen: deviceStatus.doorOpen,
        sessionId: deviceStatus.sessionId,
        userName: deviceStatus.userName,
        accessPoint: deviceStatus.accessPoint,
        lastHeartbeatAt: deviceStatus.lastHeartbeatAt,
      },
      session: latestSession
        ? {
            id: latestSession._id,
            action: latestSession.action,
            userName: latestSession.userName,
            accessPoint: latestSession.accessPoint,
            doorOpened: latestSession.doorOpened,
            doorClosed: latestSession.doorClosed,
            completed: latestSession.completed,
            createdAt: latestSession.createdAt,
            openedAt: latestSession.openedAt,
            closedAt: latestSession.closedAt,
            completedAt: latestSession.completedAt,
          }
        : null,
      command: latestCommand
        ? {
            id: latestCommand._id,
            status: latestCommand.status,
            action: latestCommand.action,
            createdAt: latestCommand.createdAt,
            claimedAt: latestCommand.claimedAt,
            completedAt: latestCommand.completedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("DOOR LIVE STATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch door live state",
      error: error.message,
    });
  }
};

const deviceHeartbeat = async (req, res) => {
  try {
    const {
      deviceId = "main-door-controller",
      ip = "",
      state = "UNKNOWN",
      doorClosed = false,
      doorOpen = false,
      sessionId = "",
      userName = "",
      accessPoint = "main-door",
    } = req.body || {};

    const now = new Date();

    const status = await DoorDeviceStatus.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          online: true,
          ip,
          state,
          doorClosed,
          doorOpen,
          sessionId,
          userName,
          accessPoint,
          lastHeartbeatAt: now,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Heartbeat recorded",
      status,
    });
  } catch (error) {
    console.error("DEVICE HEARTBEAT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record device heartbeat",
      error: error.message,
    });
  }
};

module.exports = {
  getAccessLogs,
  getInsideMembers,
  getAccessStats,
  deviceHeartbeat,
  getDoorLiveState,
  deviceDoorOpened,
  deviceDoorClosed,
  manualUnlockEvent,
  forceExitMember,
  devicePollCommand,
};