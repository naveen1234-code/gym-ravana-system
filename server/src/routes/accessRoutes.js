const express = require("express");
const router = express.Router();

const {
  getAccessLogs,
  getInsideMembers,
  getAccessStats,
  forceExitMember,
  manualUnlockEvent,
  devicePollCommand,
} = require("../controllers/accessController");

const { protect, adminOnly } = require("../middleware/authMiddleware");
const deviceAuthMiddleware = require("../middleware/deviceAuthMiddleware");

// ADMIN ACCESS CONTROL
router.get("/logs", protect, adminOnly, getAccessLogs);
router.get("/inside", protect, adminOnly, getInsideMembers);
router.get("/stats", protect, adminOnly, getAccessStats);
router.put("/force-exit", protect, adminOnly, forceExitMember);

// FINAL DOOR CONTROL FLOW
// Admin app queues unlock command
router.post("/device/manual-unlock", protect, adminOnly, manualUnlockEvent);

// ESP32 polls backend for unlock command
router.post("/device/poll", deviceAuthMiddleware, devicePollCommand);

module.exports = router;