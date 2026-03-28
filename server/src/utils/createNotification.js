const Notification = require("../models/Notification");

const createNotification = async ({
  userId = null,
  audience,
  type,
  title,
  message,
  metadata = {},
}) => {
  if (!audience || !type || !title || !message) {
    throw new Error("Missing required notification fields");
  }

  const notification = await Notification.create({
    userId,
    audience,
    type,
    title,
    message,
    metadata,
  });

  return notification;
};

module.exports = createNotification;