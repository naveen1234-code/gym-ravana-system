const AccessLog = require("../models/AccessLog");
const User = require("../models/User");
const DoorAccessSession = require("../models/DoorAccessSession");
const DoorCommand = require("../models/DoorCommand");
const createNotification = require("../utils/createNotification");
const DoorDeviceStatus = require("../models/DoorDeviceStatus");

const DOOR_DEVICE_ID = "main-door-controller";
const COMMAND_CLAIM_TIMEOUT_MS = 10000;
const APP_UNLOCK_ACK_TIMEOUT_MS = 8000;
const COMMAND_EXPIRE_MS = 30000;
const OFFLINE_AFTER_MS = 15000;

const SRI_LANKA_TZ = "Asia/Colombo";

const getSriLankaDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SRI_LANKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const normalizeDeviceAckStatus = (status = "") => {
  const value = String(status || "").trim().toUpperCase();

  const map = {
    UNLOCKED: "unlocked",
    BUSY: "busy",
    FAILED: "failed",
    REJECTED_DOOR_OPEN: "rejected_door_open",
    REJECTED_UNKNOWN_ACTION: "rejected_unknown_action",
    DUPLICATE_IGNORED: "duplicate_ignored",
    RESTARTING: "restarting",
    ONLINE: "online",
    COMPLETED: "completed",
  };

  return map[value] || "failed";
};

const isFailureStatus = (status) => {
  return [
    "busy",
    "failed",
    "rejected_door_open",
    "rejected_unknown_action",
    "expired",
  ].includes(status);
};

const getClientStatusMessage = (status, fallback = "") => {
  const messages = {
    pending: "Waiting for door controller...",
    claimed: "Door controller received the request...",
    unlocked: "Door unlocked successfully.",
    busy: "Door is busy. Please scan again after the door closes.",
    failed: "Unlock failed. Please scan again.",
    rejected_door_open: "Door is open. Close the door and scan again.",
    rejected_unknown_action: "Door command was rejected.",
    duplicate_ignored: "This request was already handled.",
    restarting: "Door controller is restarting.",
    online: "Door controller is online.",
    completed: "Door command completed.",
    expired: "Unlock request expired. Please scan again.",
  };

  return fallback || messages[status] || "Door command status updated.";
};

const updateDeviceStatusFromBody = async (reqBody = {}, reqIp = "") => {
  const {
    deviceId = DOOR_DEVICE_ID,
    ip = "",
    state,
    doorState,
    reed = "",
    doorClosed,
    doorOpen,
    sessionId = "",
    userName = "",
    accessPoint = "main-door",
  } = reqBody || {};

  const normalizedState = state || doorState || "UNKNOWN";
  const reedValue = String(reed || "").toUpperCase();

  const nextDoorClosed =
    typeof doorClosed === "boolean" ? doorClosed : reedValue === "NEAR";

  const nextDoorOpen =
    typeof doorOpen === "boolean" ? doorOpen : reedValue === "FAR";

  await DoorDeviceStatus.findOneAndUpdate(
    { deviceId },
    {
      $set: {
        online: true,
        ip: ip || reqIp || "",
        state: normalizedState,
        doorClosed: nextDoorClosed,
        doorOpen: nextDoorOpen,
        sessionId: sessionId || "",
        userName: userName || "",
        accessPoint,
        lastHeartbeatAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    }
  );
};

const findActivePendingCommand = async (deviceId = DOOR_DEVICE_ID) => {
  const now = new Date();

  return DoorCommand.findOne({
    deviceId,
    status: { $in: ["pending", "claimed"] },
    expiresAt: { $gt: now },
  }).sort({ createdAt: 1 });
};

const createDeniedAccessLogOnce = async ({
  command,
  session,
  reason,
  status,
  message,
}) => {
  const existing = await AccessLog.findOne({ commandId: command._id });

  if (existing) return existing;

  const logAction = session.action === "exit" ? "exit" : "entry";

  return AccessLog.create({
    userId: session.userId,
    userName: session.userName,
    userEmail: session.userEmail,
    action: logAction,
    result: "denied",
    reason,
    accessPoint: session.accessPoint,
    doorTriggered: false,
    doorMode: "poll",
    scanMethod:
      session.triggeredBy === "admin_override"
        ? "admin-remote-door-app"
        : "qr",
    sessionId: session._id,
    commandId: command._id,
    doorCommandStatus: status,
    deviceMessage: message,
  });
};

const createGrantedAccessLogOnce = async ({
  command,
  session,
  user,
  reason,
  status,
  message,
}) => {
  const existing = await AccessLog.findOne({ commandId: command._id });

  if (existing) return existing;

  const logAction = session.action === "exit" ? "exit" : "entry";

  return AccessLog.create({
    userId: user._id,
    userName: user.fullName || user.name || session.userName,
    userEmail: user.email || session.userEmail,
    action: logAction,
    result: "granted",
    reason,
    accessPoint: session.accessPoint,
    doorTriggered: true,
    doorMode: "poll",
    scanMethod:
      session.triggeredBy === "admin_override"
        ? "admin-remote-door-app"
        : "qr",
    sessionId: session._id,
    commandId: command._id,
    doorCommandStatus: status,
    deviceMessage: message,
  });
};

const finalizeFailedAccess = async ({ command, status, message }) => {
  const session = await DoorAccessSession.findById(command.sessionId);

  if (!session) return;

  session.completed = true;
  session.completedAt = session.completedAt || new Date();
  session.notes = `${session.notes || ""} | Door failed: ${message}`.trim();
  await session.save();

  await createDeniedAccessLogOnce({
    command,
    session,
    reason: message,
    status,
    message,
  });
};

const finalizeSuccessfulUnlock = async ({ command, message }) => {
  const session = await DoorAccessSession.findById(command.sessionId);

  if (!session) return null;

  const user = await User.findById(command.userId);

  if (!user) return null;

  const existingLog = await AccessLog.findOne({ commandId: command._id });

  if (existingLog) {
    return { user, session, alreadyFinalized: true };
  }

  const now = new Date();

  if (session.action === "entry") {
    const todayKey = getSriLankaDateKey(now);

    const alreadyDeductedToday =
      user.lastDayDeductedAt &&
      getSriLankaDateKey(user.lastDayDeductedAt) === todayKey;

    user.attendanceCount = (user.attendanceCount || 0) + 1;

    if (!alreadyDeductedToday) {
      user.remainingDays = Math.max((user.remainingDays || 0) - 1, 0);
      user.lastDayDeductedAt = now;
    }

    user.lastCheckIn = now;
    user.lastEntryAt = now;
    user.isInsideGym = true;

    if (user.remainingDays <= 0) {
      user.membershipStatus = "expired";
    }

    await user.save();

    await createGrantedAccessLogOnce({
      command,
      session,
      user,
      reason: "Entry granted after ESP32 unlock confirmation",
      status: "unlocked",
      message,
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "check_in_success",
      title: "Check-In Successful",
      message: `Door unlocked successfully. Remaining days: ${user.remainingDays}`,
      metadata: {
        remainingDays: user.remainingDays,
        attendanceCount: user.attendanceCount,
        accessPoint: session.accessPoint,
        commandId: command._id,
        doorSessionId: session._id,
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
  }

  if (session.action === "exit") {
    user.isInsideGym = false;
    user.lastExitAt = now;
    await user.save();

    await createGrantedAccessLogOnce({
      command,
      session,
      user,
      reason: "Exit granted after ESP32 unlock confirmation",
      status: "unlocked",
      message,
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "check_out_success",
      title: "Check-Out Successful",
      message: "Door unlocked successfully for exit.",
      metadata: {
        accessPoint: session.accessPoint,
        commandId: command._id,
        doorSessionId: session._id,
      },
    });
  }

  if (session.action === "manual") {
    await createGrantedAccessLogOnce({
      command,
      session,
      user,
      reason: "Admin remote unlock confirmed by ESP32",
      status: "unlocked",
      message,
    });

    await createNotification({
      audience: "admin",
      type: "manual_unlock_confirmed",
      title: "Remote Door Unlock Confirmed",
      message: `${session.userName} unlocked ${session.accessPoint}.`,
      metadata: {
        sessionId: session._id,
        commandId: command._id,
        accessPoint: session.accessPoint,
      },
    });
  }

  session.completed = true;
  session.completedAt = session.completedAt || now;
  session.notes = `${session.notes || ""} | ESP32 confirmed unlock.`.trim();
  await session.save();

  return { user, session, alreadyFinalized: false };
};

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

const manualUnlockEvent = async (req, res) => {
  try {
    const {
      accessPoint = "main-door",
      notes = "Admin remote unlock button used",
    } = req.body || {};

    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication is required",
      });
    }

    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    const activeCommand = await findActivePendingCommand(DOOR_DEVICE_ID);

    if (activeCommand) {
      return res.status(409).json({
        success: false,
        status: "busy",
        message: "Door controller already has a pending command. Try again in a moment.",
        commandId: activeCommand._id,
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

    const command = await DoorCommand.create({
      sessionId: session._id,
      userId: admin._id,
      userName: admin.fullName || admin.name || "Admin",
      action: "unlock",
      accessPoint,
      deviceId: DOOR_DEVICE_ID,
      status: "pending",
      expiresAt: new Date(Date.now() + COMMAND_EXPIRE_MS),
    });

    await createNotification({
      audience: "admin",
      type: "manual_unlock_queued",
      title: "Remote Door Unlock Queued",
      message: `${admin.fullName || admin.name || "Admin"} requested remote unlock for ${accessPoint}.`,
      metadata: {
        sessionId: session._id,
        commandId: command._id,
        adminId: admin._id,
        accessPoint,
        doorMode: "poll",
      },
    });

    return res.status(200).json({
      success: true,
      accessGranted: true,
      status: "pending",
      message: "Unlock request sent. Waiting for door controller confirmation.",
      commandId: command._id,
      sessionId: session._id,
      doorSessionId: session._id,
      doorOpened: false,
      doorMode: "poll",
      doorMessage: "Waiting for ESP32 confirmation.",
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

const createRestartCommand = async (req, res) => {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication is required",
      });
    }

    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    await DoorCommand.updateMany(
      {
        deviceId: DOOR_DEVICE_ID,
        status: { $in: ["pending", "claimed"] },
      },
      {
        $set: {
          status: "expired",
          deviceMessage: "Expired because admin requested controller restart.",
        },
      }
    );

    const session = await DoorAccessSession.create({
      userId: admin._id,
      userName: admin.fullName || admin.name || "Admin",
      userEmail: admin.email,
      action: "manual",
      accessPoint: "main-door",
      unlockApproved: true,
      triggeredBy: "admin_override",
      notes: "Admin requested ESP32 restart",
    });

    const command = await DoorCommand.create({
      sessionId: session._id,
      userId: admin._id,
      userName: admin.fullName || admin.name || "Admin",
      action: "restart",
      accessPoint: "main-door",
      deviceId: DOOR_DEVICE_ID,
      status: "pending",
      expiresAt: new Date(Date.now() + COMMAND_EXPIRE_MS),
    });

    return res.status(200).json({
      success: true,
      status: "pending",
      message: "Restart command sent. Waiting for door controller.",
      commandId: command._id,
      sessionId: session._id,
    });
  } catch (error) {
    console.error("CREATE RESTART COMMAND ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create restart command",
      error: error.message,
    });
  }
};

const devicePollCommand = async (req, res) => {
  try {
    const { deviceId = DOOR_DEVICE_ID } = req.body || {};

    await updateDeviceStatusFromBody(req.body, req.ip);

    const now = new Date();
    const staleClaimBefore = new Date(now.getTime() - COMMAND_CLAIM_TIMEOUT_MS);

    await DoorCommand.updateMany(
      {
        deviceId,
        status: { $in: ["pending", "claimed"] },
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: "expired",
          deviceMessage: "Door command expired before ESP32 confirmation.",
        },
      }
    );

    const command = await DoorCommand.findOneAndUpdate(
      {
        deviceId,
        expiresAt: { $gt: now },
        $or: [
          { status: "pending" },
          {
            status: "claimed",
            claimedAt: { $lte: staleClaimBefore },
          },
          {
            status: "claimed",
            claimedAt: null,
          },
        ],
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
        claimedAt: command.claimedAt,
        expiresAt: command.expiresAt,
      },
    });
  } catch (error) {
    console.error("DEVICE POLL COMMAND ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to poll door command",
      error: error.message,
    });
  }
};

const deviceAckCommand = async (req, res) => {
  try {
    const {
      commandId,
      sessionId,
      deviceId = DOOR_DEVICE_ID,
      status,
      message = "",
      doorState = "",
      reed = "",
      freeHeap = null,
    } = req.body || {};

    if (!commandId) {
      return res.status(400).json({
        success: false,
        message: "Command ID is required",
      });
    }

    const command = await DoorCommand.findOne({
      _id: commandId,
      deviceId,
    });

    if (!command) {
      return res.status(404).json({
        success: false,
        message: "Door command not found",
      });
    }

    if (sessionId && String(command.sessionId) !== String(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Session ID does not match command",
      });
    }

    const now = new Date();

const normalizedStatus = normalizeDeviceAckStatus(
  status || (command.action === "restart" ? "RESTARTING" : "UNLOCKED")
);

const clientMessage = getClientStatusMessage(normalizedStatus, message);

// Idempotent ACK:
// If the same final ACK is sent again, accept it safely.
if (
  !["pending", "claimed"].includes(command.status) &&
  command.status === normalizedStatus
) {
  return res.status(200).json({
    success: true,
    message: "Door command ACK already recorded",
    command,
  });
}

// Late ACK protection:
// If app/backend already finalized this command as failed/expired/etc,
// do not allow a late ESP32 ACK to turn it into success.
if (!["pending", "claimed"].includes(command.status)) {
  return res.status(409).json({
    success: false,
    message: `Door command is already ${command.status}. Late ACK ignored.`,
    command,
  });
}

    command.status = normalizedStatus;
    command.deviceAckStatus = status || normalizedStatus.toUpperCase();
    command.deviceMessage = clientMessage;
    command.deviceState = doorState || "";
    command.deviceReed = reed || "";
    command.deviceFreeHeap = Number.isFinite(Number(freeHeap))
      ? Number(freeHeap)
      : null;
    command.acknowledgedAt = now;

    if (!command.claimedAt) {
      command.claimedAt = now;
    }

    if (normalizedStatus === "unlocked") {
      command.unlockedAt = now;
    }

    if (isFailureStatus(normalizedStatus)) {
      command.failedAt = now;
    }

    if (normalizedStatus === "completed") {
      command.completedAt = now;
    }

    await command.save();

    if (normalizedStatus === "unlocked") {
      await finalizeSuccessfulUnlock({
        command,
        message: clientMessage,
      });
    }

    if (isFailureStatus(normalizedStatus)) {
      await finalizeFailedAccess({
        command,
        status: normalizedStatus,
        message: clientMessage,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Door command ACK recorded successfully",
      command,
    });
  } catch (error) {
    console.error("DEVICE ACK COMMAND ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to acknowledge door command",
      error: error.message,
    });
  }
};

const getCommandStatus = async (req, res) => {
  try {
    const { commandId } = req.params;

    if (!commandId) {
      return res.status(400).json({
        success: false,
        message: "Command ID is required",
      });
    }

    const command = await DoorCommand.findById(commandId);

    if (!command) {
      return res.status(404).json({
        success: false,
        message: "Door command not found",
      });
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner = String(command.userId) === String(req.user?.id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this door command",
      });
    }

    const now = new Date();

    if (
      ["pending", "claimed"].includes(command.status) &&
      now.getTime() - new Date(command.createdAt).getTime() >= APP_UNLOCK_ACK_TIMEOUT_MS
    ) {
      command.status = "failed";
      command.failedAt = now;
      command.deviceMessage = "Door controller did not confirm unlock in time.";
      await command.save();

      await finalizeFailedAccess({
        command,
        status: "failed",
        message: command.deviceMessage,
      });
    }

    const session = await DoorAccessSession.findById(command.sessionId);
    const user = await User.findById(command.userId).select("-password");

    return res.status(200).json({
      success: true,
      status: command.status,
      message: getClientStatusMessage(command.status, command.deviceMessage),
      command: {
        id: command._id,
        action: command.action,
        status: command.status,
        deviceAckStatus: command.deviceAckStatus,
        deviceMessage: command.deviceMessage,
        deviceState: command.deviceState,
        deviceReed: command.deviceReed,
        createdAt: command.createdAt,
        claimedAt: command.claimedAt,
        acknowledgedAt: command.acknowledgedAt,
        unlockedAt: command.unlockedAt,
        failedAt: command.failedAt,
        completedAt: command.completedAt,
        expiresAt: command.expiresAt,
      },
      session,
      user,
    });
  } catch (error) {
    console.error("GET COMMAND STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch command status",
      error: error.message,
    });
  }
};

const getDoorLiveState = async (req, res) => {
  try {
    const deviceId = DOOR_DEVICE_ID;
    const now = new Date();

    const deviceStatus = await DoorDeviceStatus.findOne({ deviceId });

    const latestSession = await DoorAccessSession.findOne({
      accessPoint: "main-door",
    }).sort({ createdAt: -1 });

    const latestCommand = await DoorCommand.findOne({
      deviceId,
    }).sort({ createdAt: -1 });

    const hasHeartbeat =
      deviceStatus?.lastHeartbeatAt &&
      now.getTime() - new Date(deviceStatus.lastHeartbeatAt).getTime() <=
        OFFLINE_AFTER_MS;

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
    let message = "Door is locked and ready.";

    if (state === "LOCKED_READY") {
      color = "red";
      isUnlocked = false;
      message = "Door is locked and ready.";
    }

    if (state === "UNLOCK_WAITING_FOR_PUSH") {
      color = "green";
      isUnlocked = true;
      message = "Door is unlocked. Waiting for push.";
    }

    if (state === "DOOR_OPEN_LOCKED") {
      color = "orange";
      isUnlocked = false;
      message = "Door is open. Relay is locked. Waiting for door to close.";
    }

    if (
      latestCommand &&
      ["pending", "claimed"].includes(latestCommand.status) &&
      state === "LOCKED_READY"
    ) {
      state = "UNLOCK_PENDING";
      color = "orange";
      isUnlocked = false;
      message = "Unlock command is waiting for ESP32 confirmation.";
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
            deviceMessage: latestCommand.deviceMessage,
            createdAt: latestCommand.createdAt,
            claimedAt: latestCommand.claimedAt,
            acknowledgedAt: latestCommand.acknowledgedAt,
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
    await updateDeviceStatusFromBody(req.body, req.ip);

    const status = await DoorDeviceStatus.findOne({
      deviceId: req.body?.deviceId || DOOR_DEVICE_ID,
    });

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

// BACKWARD COMPATIBILITY ONLY
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

// BACKWARD COMPATIBILITY ONLY
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

module.exports = {
  getAccessLogs,
  getInsideMembers,
  getAccessStats,
  deviceHeartbeat,
  getDoorLiveState,
  deviceDoorOpened,
  deviceDoorClosed,
  manualUnlockEvent,
  createRestartCommand,
  getCommandStatus,
  forceExitMember,
  devicePollCommand,
  deviceAckCommand,
};