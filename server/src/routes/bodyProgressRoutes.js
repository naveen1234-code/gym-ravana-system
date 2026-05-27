const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authMiddleware");

const {
  upload,
  listEntriesForUser,
  getStatusForUser,
  createEntryForUser,
  updateEntryForUser,
  deleteEntry,
} = require("../controllers/bodyProgressController");

// MEMBER
router.get("/me", protect, (req, res) => listEntriesForUser(req, res));
router.get("/me/status", protect, (req, res) => getStatusForUser(req, res));
router.post(
  "/me",
  protect,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "side", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  (req, res) => createEntryForUser(req, res)
);
router.put(
  "/me/:entryId",
  protect,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "side", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  (req, res) => updateEntryForUser(req, res)
);

// ADMIN
router.get("/user/:userId", protect, adminOnly, (req, res) =>
  listEntriesForUser(req, res)
);
router.get("/user/:userId/status", protect, adminOnly, (req, res) =>
  getStatusForUser(req, res)
);
router.post(
  "/user/:userId",
  protect,
  adminOnly,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "side", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  (req, res) => createEntryForUser(req, res)
);
router.put(
  "/user/:userId/:entryId",
  protect,
  adminOnly,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "side", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  (req, res) => updateEntryForUser(req, res)
);
router.delete("/:entryId", protect, adminOnly, deleteEntry);

module.exports = router;

