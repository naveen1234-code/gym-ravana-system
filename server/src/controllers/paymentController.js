const Payment = require("../models/Payment");
const User = require("../models/User");
const buildPayHereCheckoutData = require("../utils/payhereCheckoutData");
const createNotification = require("../utils/createNotification");
const sendSMS = require("../utils/sendSMS");
const generateMonthlyStatementPdf = require("../utils/generateMonthlyStatementPdf");

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

const getMonthDateRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 1, 0, 0, 0, 0);
  return { startDate, endDate };
};

const generateReceiptNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `GR-RCPT-${year}${month}${day}-${randomPart}`;
};

const applyMembershipFromPayment = async (payment, user) => {
  const previousStatus = user.membershipStatus;
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

  return { previousStatus };
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

    await createNotification({
      audience: "admin",
      type: "payment_pending",
      title: "New Payment Created",
      message: `${user.name} created a payment for ${planName} (LKR ${amount}).`,
      metadata: {
        paymentId: payment._id,
        userId: user._id,
        planName,
        amount,
      },
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "payment_created",
      title: "Payment Created",
      message: `Your payment for ${planName} has been created and is currently pending.`,
      metadata: {
        paymentId: payment._id,
        amount,
      },
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

    const previousStatus = user.membershipStatus;
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

    await createNotification({
      audience: "admin",
      type: "payment_success",
      title: "Payment Marked as Paid",
      message: `${user.name} payment for ${payment.planName} was marked as paid.`,
      metadata: {
        paymentId: payment._id,
        userId: user._id,
        amount: payment.amount,
      },
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "payment_success",
      title: "Payment Successful",
      message: `Your payment for ${payment.planName} was successful.`,
      metadata: {
        paymentId: payment._id,
        amount: payment.amount,
      },
    });

    if (previousStatus !== "active") {
      await createNotification({
        audience: "admin",
        type: "membership_activated",
        title: "Membership Activated",
        message: `${user.name} membership is now active via payment.`,
        metadata: {
          userId: user._id,
          membershipPlan: user.membershipPlan,
        },
      });

      await createNotification({
        userId: user._id,
        audience: "member",
        type: "membership_activated",
        title: "Membership Activated",
        message: `Your membership is now active under the ${user.membershipPlan} plan.`,
        metadata: {
          membershipEndDate: user.membershipEndDate,
          remainingDays: user.remainingDays,
        },
      });
    }

    // SMS to admin when a member activates or updates membership
// SMS to member after successful payment
try {
  if (user.mobileNumber) {
    await sendSMS({
      phone: user.mobileNumber,
      message: `Gym Ravana: Your payment for ${payment.planName} was successful. Your membership is now active with ${user.remainingDays} remaining days.`,
    });
  }
} catch (smsError) {
  console.error("MEMBER PAYMENT SMS ERROR:", smsError.message);
}

// SMS to admin when a member activates or updates membership
try {
  if (process.env.ADMIN_MOBILE_NUMBER) {
    await sendSMS({
      phone: process.env.ADMIN_MOBILE_NUMBER,
      message: `Gym Ravana: ${user.name} has purchased ${payment.planName}. Membership active. Remaining days: ${user.remainingDays}.`,
    });
  }
} catch (smsError) {
  console.error("ADMIN MEMBERSHIP SMS ERROR:", smsError.message);
}

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

const createManualPayment = async (req, res) => {
  try {
    const { userId, planName, amount, paymentMethod, notes, transactionId } = req.body;

    if (!userId || !planName || !amount || !paymentMethod) {
      return res.status(400).json({
        message: "User ID, plan name, amount, and payment method are required",
      });
    }

    if (!["Cash", "Bank Transfer", "Manual"].includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid manual payment method",
      });
    }

    const adminUser = await User.findById(req.user.id);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can record manual payments",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    const receiptNumber = generateReceiptNumber();
    const paidAt = new Date();

    const payment = await Payment.create({
      userId: user._id,
      userName: user.fullName || user.name,
      userEmail: user.email,
      planName,
      amount,
      status: "paid",
      paymentMethod,
      transactionId: transactionId || "",
      receiptNumber,
      notes: notes || "",
      recordedByAdminId: adminUser._id,
      recordedByAdminName: adminUser.fullName || adminUser.name,
      paidAt,
    });

    const { previousStatus } = await applyMembershipFromPayment(payment, user);

    await createNotification({
      audience: "admin",
      type: "manual_payment_recorded",
      title: "Manual Payment Recorded",
      message: `${user.name} manual payment recorded for ${planName} (LKR ${amount}) via ${paymentMethod}.`,
      metadata: {
        paymentId: payment._id,
        userId: user._id,
        planName,
        amount,
        paymentMethod,
        receiptNumber,
      },
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "payment_success",
      title: "Payment Recorded",
      message: `Your ${paymentMethod} payment for ${planName} has been recorded successfully.`,
      metadata: {
        paymentId: payment._id,
        amount,
        paymentMethod,
        receiptNumber,
      },
    });

    if (previousStatus !== "active") {
      await createNotification({
        audience: "admin",
        type: "membership_activated",
        title: "Membership Activated",
        message: `${user.name} membership is now active via manual payment.`,
        metadata: {
          userId: user._id,
          membershipPlan: user.membershipPlan,
        },
      });

      await createNotification({
        userId: user._id,
        audience: "member",
        type: "membership_activated",
        title: "Membership Activated",
        message: `Your membership is now active under the ${user.membershipPlan} plan.`,
        metadata: {
          membershipEndDate: user.membershipEndDate,
          remainingDays: user.remainingDays,
        },
      });
    }

    try {
      if (user.mobileNumber) {
        await sendSMS({
          phone: user.mobileNumber,
          message: `Gym Ravana: Your ${paymentMethod} payment for ${planName} has been recorded. Receipt: ${receiptNumber}. Remaining days: ${user.remainingDays}.`,
        });
      }
    } catch (smsError) {
      console.error("MANUAL MEMBER PAYMENT SMS ERROR:", smsError.message);
    }

    try {
      if (process.env.ADMIN_MOBILE_NUMBER) {
        await sendSMS({
          phone: process.env.ADMIN_MOBILE_NUMBER,
          message: `Gym Ravana: Manual payment recorded for ${user.name}. Plan: ${planName}. Method: ${paymentMethod}. Receipt: ${receiptNumber}.`,
        });
      }
    } catch (smsError) {
      console.error("MANUAL ADMIN PAYMENT SMS ERROR:", smsError.message);
    }

    return res.status(201).json({
      message: "Manual payment recorded successfully ✅",
      payment,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to record manual payment",
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

// GET MONTHLY PAYMENT STATEMENT
const getMonthlyPaymentStatement = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        message: "Year and month are required",
      });
    }

    const parsedYear = Number(year);
    const parsedMonth = Number(month);

    if (
      Number.isNaN(parsedYear) ||
      Number.isNaN(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      return res.status(400).json({
        message: "Invalid year or month",
      });
    }

    const { startDate, endDate } = getMonthDateRange(parsedYear, parsedMonth);

    const payments = await Payment.find({
      status: "paid",
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    }).sort({ createdAt: -1 });

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalPayments = payments.length;

    return res.status(200).json({
      year: parsedYear,
      month: parsedMonth,
      totalRevenue,
      totalPayments,
      payments,
      period: {
        startDate,
        endDate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to get monthly payment statement",
      error: error.message,
    });
  }
};

const downloadMonthlyPaymentStatementPdf = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        message: "Year and month are required",
      });
    }

    const parsedYear = Number(year);
    const parsedMonth = Number(month);

    if (
      Number.isNaN(parsedYear) ||
      Number.isNaN(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      return res.status(400).json({
        message: "Invalid year or month",
      });
    }

    const { startDate, endDate } = getMonthDateRange(parsedYear, parsedMonth);

    const payments = await Payment.find({
      status: "paid",
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    }).sort({ createdAt: -1 });

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalPayments = payments.length;

    return generateMonthlyStatementPdf({
      res,
      year: parsedYear,
      month: parsedMonth,
      payments,
      totalRevenue,
      totalPayments,
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to generate monthly statement PDF",
        error: error.message,
      });
    }

    console.error("MONTHLY STATEMENT PDF ERROR:", error.message);
  }
};

module.exports = {
  createPayment,
  createManualPayment,
  getMyPayments,
  markPaymentAsPaid,
  downloadMonthlyPaymentStatementPdf,
  getMonthlyPaymentStatement,
  getAllPayments,
  getPayHereCheckoutData,

};