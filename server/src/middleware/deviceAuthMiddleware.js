const deviceAuthMiddleware = (req, res, next) => {
  try {
    const expectedSecret = process.env.ESP32_SHARED_SECRET;

    if (!expectedSecret) {
      return res.status(500).json({
        message: "ESP32 shared secret is not configured",
      });
    }

    const providedSecret = req.headers["x-door-secret"];

    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({
        message: "Unauthorized device request",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Device authentication failed",
      error: error.message,
    });
  }
};

module.exports = deviceAuthMiddleware;