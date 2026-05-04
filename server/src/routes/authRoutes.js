const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateMembership,
  makeAdmin,
  getAllUsers,
  checkInMember,
  checkOutMember,
  sendApplicationEmailTest,
  sendTestSMS,
  regenerateApplicationPdfs,
} = require("../controllers/authController");

const { protect, adminOnly } = require("../middleware/authMiddleware");

// AUTH
// AUTH
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getCurrentUser);

// ADMIN
router.get("/users", protect, adminOnly, getAllUsers);
router.put("/make-admin", protect, adminOnly, makeAdmin);
router.put("/membership", protect, adminOnly, updateMembership);
router.post("/regenerate-application-pdfs", protect, adminOnly, regenerateApplicationPdfs);

// MEMBER ACCESS
router.post("/check-in", protect, checkInMember);
router.post("/check-out", protect, checkOutMember);

// TEST EMAIL
router.get("/test-mail", sendApplicationEmailTest);
router.get("/test-sms", sendTestSMS);

module.exports = router;