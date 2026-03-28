const express = require("express");
const {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/my", protect, getMyNotifications);
router.get("/unread-count", protect, getUnreadNotificationCount);
router.put("/read", protect, markNotificationAsRead);
router.put("/read-all", protect, markAllNotificationsAsRead);

module.exports = router;