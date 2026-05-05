const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");

const SYSTEM_KEY = "global_system_status";

const getOrCreateSystemSetting = async () => {
  let setting = await SystemSetting.findOne({ key: SYSTEM_KEY });

  if (!setting) {
    setting = await SystemSetting.create({
      key: SYSTEM_KEY,
      maintenanceMode: false,
    });
  }

  return setting;
};

const getSystemStatus = async (req, res) => {
  try {
    const setting = await getOrCreateSystemSetting();

    return res.status(200).json({
      success: true,
      maintenanceMode: setting.maintenanceMode,
      title: setting.title,
      headline: setting.headline,
      message: setting.message,
      updatedAt: setting.updatedAt,
      updatedByName: setting.updatedByName,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch system status",
      error: error.message,
    });
  }
};

const updateSystemStatus = async (req, res) => {
  try {
    const {
      maintenanceMode,
      title,
      headline,
      message,
    } = req.body || {};

    if (typeof maintenanceMode !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "maintenanceMode must be true or false",
      });
    }

    const admin = await User.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin user not found",
      });
    }

    const setting = await getOrCreateSystemSetting();

    setting.maintenanceMode = maintenanceMode;

    if (typeof title === "string" && title.trim()) {
      setting.title = title.trim();
    }

    if (typeof headline === "string" && headline.trim()) {
      setting.headline = headline.trim();
    }

    if (typeof message === "string" && message.trim()) {
      setting.message = message.trim();
    }

    setting.updatedBy = admin._id;
    setting.updatedByName = admin.fullName || admin.name || admin.email || "Admin";

    await setting.save();

    return res.status(200).json({
      success: true,
      message: maintenanceMode
        ? "System shutdown mode enabled"
        : "System shutdown mode disabled",
      maintenanceMode: setting.maintenanceMode,
      title: setting.title,
      headline: setting.headline,
      systemMessage: setting.message,
      updatedAt: setting.updatedAt,
      updatedByName: setting.updatedByName,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update system status",
      error: error.message,
    });
  }
};

module.exports = {
  getSystemStatus,
  updateSystemStatus,
};