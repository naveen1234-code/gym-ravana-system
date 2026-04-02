const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const gallerySections = require("../data/gallerySections.json");

const galleryBasePath = path.join(__dirname, "../../uploads/gallery");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { sectionId } = req.body;
    const sectionPath = path.join(galleryBasePath, sectionId);

    if (!fs.existsSync(sectionPath)) {
      fs.mkdirSync(sectionPath, { recursive: true });
    }

    cb(null, sectionPath);
  },
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/\s+/g, "-");
    const uniqueName = `${Date.now()}-${safeOriginalName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// upload images
router.post("/upload", upload.array("images", 20), (req, res) => {
  try {
    const { sectionId } = req.body;

    const section = gallerySections.find((item) => item.id === sectionId);

    if (!section) {
      return res.status(400).json({ message: "Invalid gallery section" });
    }

    const uploadedFiles = (req.files || []).map((file) => ({
      fileName: file.filename,
      imageUrl: `/uploads/gallery/${sectionId}/${file.filename}`,
    }));

    return res.status(201).json({
      message: "Images uploaded successfully",
      files: uploadedFiles,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
});

// delete image
router.delete("/delete", (req, res) => {
  try {
    const { sectionId, fileName } = req.body;

    if (!sectionId || !fileName) {
      return res.status(400).json({
        message: "sectionId and fileName are required",
      });
    }

    const filePath = path.join(galleryBasePath, sectionId, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Image not found" });
    }

    fs.unlinkSync(filePath);

    return res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Delete failed",
      error: error.message,
    });
  }
});

module.exports = router;