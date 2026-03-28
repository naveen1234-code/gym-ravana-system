const Notification = require("../models/Notification");

// GET notifications for current logged-in user
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let notifications = [];

    if (userRole === "admin") {
      notifications = await Notification.find({
        $or: [{ audience: "admin" }, { audience: "all" }],
      }).sort({ createdAt: -1 });
    } else {
      notifications = await Notification.find({
        $or: [{ userId }, { audience: "all" }],
      }).sort({ createdAt: -1 });
    }

    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// MARK one notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const isAllowed =
      userRole === "admin"
        ? notification.audience === "admin" || notification.audience === "all"
        : String(notification.userId) === String(userId) ||
          notification.audience === "all";

    if (!isAllowed) {
      return res.status(403).json({ message: "Not allowed to update this notification" });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

// MARK all as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "admin") {
      await Notification.updateMany(
        {
          $or: [{ audience: "admin" }, { audience: "all" }],
          isRead: false,
        },
        { $set: { isRead: true } }
      );
    } else {
      await Notification.updateMany(
        {
          $or: [{ userId }, { audience: "all" }],
          isRead: false,
        },
        { $set: { isRead: true } }
      );
    }

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to mark all notifications",
      error: error.message,
    });
  }
};

// GET unread count
const getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let count = 0;

    if (userRole === "admin") {
      count = await Notification.countDocuments({
        $or: [{ audience: "admin" }, { audience: "all" }],
        isRead: false,
      });
    } else {
      count = await Notification.countDocuments({
        $or: [{ userId }, { audience: "all" }],
        isRead: false,
      });
    }

    return res.status(200).json({ count });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch unread notification count",
      error: error.message,
    });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
};