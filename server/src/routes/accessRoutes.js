const express = require("express");
const router = express.Router();

const {
  getAccessLogs,
  getInsideMembers,
  getAccessStats,
  forceExitMember,
  deviceDoorOpened,
  deviceDoorClosed,
  manualUnlockEvent,
} = require("../controllers/accessController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

// ADMIN ACCESS CONTROL
router.get("/logs", protect, adminOnly, getAccessLogs);
router.get("/inside", protect, adminOnly, getInsideMembers);
router.get("/stats", protect, adminOnly, getAccessStats);
router.put("/force-exit", protect, adminOnly, forceExitMember);

// HARDWARE / DOOR EVENTS
router.post("/device/door-opened", deviceDoorOpened);
router.post("/device/door-closed", deviceDoorClosed);
router.post("/device/manual-unlock", protect, manualUnlockEvent);

module.exports = router;