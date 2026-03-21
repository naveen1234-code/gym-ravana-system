const express = require("express");
const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateMembership,
  makeAdmin,
  getAllUsers,
  checkInMember,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.get("/users", protect, adminOnly, getAllUsers);
router.put("/make-admin", makeAdmin);
router.post("/login", loginUser);
router.get("/me", protect, getCurrentUser);
router.put("/membership", updateMembership);
router.post("/check-in", protect, checkInMember);

module.exports = router;