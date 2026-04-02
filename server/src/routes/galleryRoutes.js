const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const gallerySections = require("../data/gallerySections.json");

const galleryBasePath = path.join(__dirname, "../../uploads/gallery");
const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const getSectionImages = (sectionId) => {
  const sectionPath = path.join(galleryBasePath, sectionId);

  if (!fs.existsSync(sectionPath)) {
    return [];
  }

  return fs
    .readdirSync(sectionPath)
    .filter((file) => imageExtensions.includes(path.extname(file).toLowerCase()))
    .map((file) => ({
      fileName: file,
      imageUrl: `/uploads/gallery/${sectionId}/${file}`,
    }));
};

// GET /api/gallery
router.get("/", (req, res) => {
  try {
    const result = gallerySections.map((section) => ({
      ...section,
      images: getSectionImages(section.id),
    }));

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load gallery",
      error: error.message,
    });
  }
});

// GET /api/gallery/:sectionId
router.get("/:sectionId", (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = gallerySections.find((item) => item.id === sectionId);

    if (!section) {
      return res.status(404).json({
        message: "Gallery section not found",
      });
    }

    return res.status(200).json({
      ...section,
      images: getSectionImages(sectionId),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load gallery section",
      error: error.message,
    });
  }
});

module.exports = router;