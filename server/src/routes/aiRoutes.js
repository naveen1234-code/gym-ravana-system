const express = require("express");
const router = express.Router();
const { getAIHealthAudit } = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

router.post("/ai-coach", protect, getAIHealthAudit);

module.exports = router;
