const express = require("express");
const router = express.Router();

const {
  getSystemStatus,
  updateSystemStatus,
} = require("../controllers/systemController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

// Public route: frontend checks this to know if overlay should show
router.get("/status", getSystemStatus);

// Admin route: hidden/admin control can turn shutdown ON/OFF
router.put("/status", protect, adminOnly, updateSystemStatus);

module.exports = router;