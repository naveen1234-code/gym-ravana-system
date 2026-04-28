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
 devicePollCommand,
deviceHeartbeat,
getDoorLiveState, 

} = require("../controllers/accessController");

const { protect, adminOnly } = require("../middleware/authMiddleware");
const deviceAuthMiddleware = require("../middleware/deviceAuthMiddleware");

// ADMIN ACCESS CONTROL
router.get("/logs", protect, adminOnly, getAccessLogs);
router.get("/inside", protect, adminOnly, getInsideMembers);
router.get("/stats", protect, adminOnly, getAccessStats);
router.put("/force-exit", protect, adminOnly, forceExitMember);


// HARDWARE / DOOR EVENTS
router.post("/device/door-opened", deviceAuthMiddleware, deviceDoorOpened);
router.post("/device/door-closed", deviceAuthMiddleware, deviceDoorClosed);
router.post("/device/manual-unlock", protect, adminOnly, manualUnlockEvent);
router.post("/device/poll", deviceAuthMiddleware, devicePollCommand);
router.post("/device/heartbeat", deviceAuthMiddleware, deviceHeartbeat);
router.get("/device/live-state", protect, adminOnly, getDoorLiveState);
module.exports = router;