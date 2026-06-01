const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "gym-ravana",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "limit" },
      { quality: "auto" },
    ],
  },
});

const upload = multer({ storage: storage });

// Upload Avatar
router.post("/avatar", protect, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.profilePicture = req.file.secure_url;
    await user.save();

    return res.status(200).json({
      message: "Avatar uploaded successfully",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// Upload Progress Photo
router.post("/progress", protect, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize healthMetrics if it doesn't exist
    if (!user.healthMetrics) {
      user.healthMetrics = {
        weightLogs: [],
        bodyFatLogs: [],
        muscleMassLogs: [],
        hydrationLogs: [],
        sleepLogs: [],
        progressPhotos: [],
        measurementHistory: []
      };
    }

    if (!user.healthMetrics.progressPhotos) {
      user.healthMetrics.progressPhotos = [];
    }

    user.healthMetrics.progressPhotos.push({
      url: req.file.secure_url,
      date: new Date(),
    });

    await user.save();

    return res.status(200).json({
      message: "Progress photo uploaded successfully",
      progressPhotos: user.healthMetrics.progressPhotos,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
