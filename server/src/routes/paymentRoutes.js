const express = require("express");
const {
  createPayment,
  getMyPayments,
  markPaymentAsPaid,
  getPayHereCheckoutData,
  getAllPayments,
} = require("../controllers/paymentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createPayment);
router.get("/my", protect, getMyPayments);
router.put("/mark-paid", protect, markPaymentAsPaid);
router.post("/payhere-data", protect, getPayHereCheckoutData);

// Admin route
router.get("/all", protect, adminOnly, getAllPayments);

module.exports = router;