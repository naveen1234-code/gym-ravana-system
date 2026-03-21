const Payment = require("../models/Payment");
const User = require("../models/User");
const buildPayHereCheckoutData = require("../utils/payhereCheckoutData");


const getPlanDays = (planName) => {
  switch (planName) {
    case "Monthly":
      return 30;
    case "3 Months":
      return 90;
    case "6 Months":
      return 180;
    case "1 Year":
      return 365;
    case "Couple 1 Year":
      return 365;
    case "Personal Training":
      return 30;
    default:
      return 0;
  }
};

// CREATE PAYMENT RECORD
const createPayment = async (req, res) => {
  try {
    const { planName, amount } = req.body;

    if (!planName || !amount) {
      return res
        .status(400)
        .json({ message: "Plan name and amount are required" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const payment = await Payment.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      planName,
      amount,
      status: "pending",
      paymentMethod: "PayHere",
    });

    return res.status(201).json({
      message: "Payment record created successfully",
      payment,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET MY PAYMENTS
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });

    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// MARK PAYMENT AS PAID + STACK MEMBERSHIP
const markPaymentAsPaid = async (req, res) => {
  try {
    const { paymentId, transactionId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID is required" });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "paid") {
      return res.status(400).json({ message: "Payment already marked as paid" });
    }

    payment.status = "paid";
    payment.transactionId = transactionId || "";
    await payment.save();

    const user = await User.findById(payment.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newPlanDays = getPlanDays(payment.planName);
    const today = new Date();

    const currentRemainingDays =
      user.membershipStatus === "active" && user.remainingDays > 0
        ? user.remainingDays
        : 0;

    const updatedRemainingDays = currentRemainingDays + newPlanDays;
    const updatedTotalDays = (user.totalDays || 0) + newPlanDays;

    const startDate =
      user.membershipStatus === "active" &&
      user.membershipStartDate &&
      user.remainingDays > 0
        ? user.membershipStartDate
        : today;

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + updatedRemainingDays);

    user.membershipStatus = "active";
    user.membershipPlan = payment.planName;
    user.membershipStartDate = startDate;
    user.membershipEndDate = endDate;
    user.totalDays = updatedTotalDays;
    user.remainingDays = updatedRemainingDays;

    await user.save();

    return res.status(200).json({
      message: "Payment marked as paid and membership stacked successfully ✅",
      payment,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const getPayHereCheckoutData = async (req, res) => {
  try {
    const { planName, amount } = req.body;

    if (!planName || !amount) {
      return res
        .status(400)
        .json({ message: "Plan name and amount are required" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const orderId = `ORDER_${Date.now()}`;

    const checkoutData = buildPayHereCheckoutData({
      orderId,
      user,
      planName,
      amount,
    });

    return res.status(200).json({
      message: "PayHere checkout data prepared successfully",
      checkoutData,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });

    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createPayment,
  getMyPayments,
  markPaymentAsPaid,
  getAllPayments,
  getPayHereCheckoutData,
};