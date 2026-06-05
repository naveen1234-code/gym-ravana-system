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
  sendBulkMemberSMS,
  retryFailedMemberSMS,
  getLegacyClaims,
  approveLegacyClaim,
  rejectLegacyClaim,
  updateLegacyClaim,
  updateProfilePicture,
  logHealthMetrics,
  getHealthMetrics,
  updateProfileDetails,
  saveMeasurementHistory,
  saveBeforeAfterMeasurements,
  uploadBeforeAfterPhoto,
  deleteBeforeAfterPhoto,
  calculateBMI,
  saveWorkoutRoutine, // <--- ADDED
  getWorkoutRoutine,  // <--- ADDED
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
router.post("/bulk-member-sms", protect, adminOnly, sendBulkMemberSMS);
router.post("/retry-failed-member-sms", protect, adminOnly, retryFailedMemberSMS);
router.get("/legacy-claims", protect, adminOnly, getLegacyClaims);
router.put("/legacy-claims/:id/approve", protect, adminOnly, approveLegacyClaim);
router.put("/legacy-claims/:id/reject", protect, adminOnly, rejectLegacyClaim);
router.put("/legacy-claims/:id", protect, adminOnly, updateLegacyClaim);
// MEMBER ACCESS
router.post("/check-in", protect, checkInMember);
router.post("/check-out", protect, checkOutMember);
// PROFILE & HEALTH
router.put("/profile-picture", protect, updateProfilePicture);
router.post("/health-metrics", protect, logHealthMetrics);
router.get("/health-metrics", protect, getHealthMetrics);

// --- NEW ROUTINE TRACKING ENDPOINTS ---
router.post("/routine", protect, saveWorkoutRoutine);
router.get("/routine", protect, getWorkoutRoutine);

router.put("/profile-details", protect, updateProfileDetails);
router.post("/measurement-history", protect, saveMeasurementHistory);
router.post("/before-after-measurements", protect, saveBeforeAfterMeasurements);
router.post("/before-after-photos", protect, uploadBeforeAfterPhoto);
router.delete("/before-after-photos/:type/:view", protect, deleteBeforeAfterPhoto);
router.get("/bmi", protect, calculateBMI);

// TEST EMAIL
router.get("/test-mail", sendApplicationEmailTest);
router.get("/test-sms", sendTestSMS);

module.exports = router;