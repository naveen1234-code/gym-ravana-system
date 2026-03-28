const express = require("express");
const {
  createPayment,
  createManualPayment,
  getMyPayments,
  markPaymentAsPaid,
  getPayHereCheckoutData,
  getAllPayments,
  getMonthlyPaymentStatement,
  downloadMonthlyPaymentStatementPdf
} = require("../controllers/paymentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createPayment);
router.get("/my", protect, getMyPayments);
router.put("/mark-paid", protect, markPaymentAsPaid);
router.post("/payhere-data", protect, getPayHereCheckoutData);

// Admin routes
router.post("/manual", protect, adminOnly, createManualPayment);
router.get("/all", protect, adminOnly, getAllPayments);
router.get("/monthly-statement", protect, adminOnly, getMonthlyPaymentStatement);
router.get("/monthly-statement-pdf", protect, adminOnly, downloadMonthlyPaymentStatementPdf);

module.exports = router;
