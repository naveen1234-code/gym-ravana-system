const express = require("express");
const {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus,
} = require("../controllers/bookingController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createBooking);
router.get("/my", protect, getMyBookings);

// Admin routes
router.get("/all", protect, adminOnly, getAllBookings);
router.put("/status", protect, adminOnly, updateBookingStatus);

module.exports = router;