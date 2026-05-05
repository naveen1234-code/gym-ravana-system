const express = require("express");
const router = express.Router();

const {
  getAccessLogs,
  getInsideMembers,
  getAccessStats,
  forceExitMember,
  manualUnlockEvent,
  createRestartCommand,
  getCommandStatus,
  getDoorLiveState,
  deviceHeartbeat,
  devicePollCommand,
  deviceAckCommand,
} = require("../controllers/accessController");

const { protect, adminOnly } = require("../middleware/authMiddleware");
const deviceAuthMiddleware = require("../middleware/deviceAuthMiddleware");

// ADMIN ACCESS CONTROL
router.get("/logs", protect, adminOnly, getAccessLogs);
router.get("/inside", protect, adminOnly, getInsideMembers);
router.get("/stats", protect, adminOnly, getAccessStats);
router.put("/force-exit", protect, adminOnly, forceExitMember);

// APP COMMAND STATUS
router.get("/command-status/:commandId", protect, getCommandStatus);

// ADMIN DOOR CONTROL
router.post("/device/manual-unlock", protect, adminOnly, manualUnlockEvent);
router.post("/device/restart", protect, adminOnly, createRestartCommand);
router.get("/device/live-state", protect, adminOnly, getDoorLiveState);

// ESP32 DEVICE ROUTES
router.post("/device/heartbeat", deviceAuthMiddleware, deviceHeartbeat);
router.post("/device/poll", deviceAuthMiddleware, devicePollCommand);
router.post("/device/ack", deviceAuthMiddleware, deviceAckCommand);

module.exports = router;