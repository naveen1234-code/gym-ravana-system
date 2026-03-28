const Booking = require("../models/Booking");
const User = require("../models/User");
const createNotification = require("../utils/createNotification");
const sendSMS = require("../utils/sendSMS");

// CREATE BOOKING
const createBooking = async (req, res) => {
  try {
    const { bookingType, bookingName, bookingDate, bookingTime } = req.body;

    if (!bookingType || !bookingName || !bookingDate || !bookingTime) {
      return res.status(400).json({
        message: "All booking fields are required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingBooking = await Booking.findOne({
      userId: user._id,
      bookingDate,
      bookingTime,
      bookingName,
      status: { $in: ["pending", "approved"] },
    });

    if (existingBooking) {
      return res.status(400).json({
        message: "You already booked this slot",
      });
    }

    const booking = await Booking.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      bookingType,
      bookingName,
      bookingDate,
      bookingTime,
      status: "pending",
    });

    await createNotification({
      audience: "admin",
      type: "new_booking",
      title: "New Booking Submitted",
      message: `${user.name} created a new ${bookingType} booking for ${bookingName}.`,
      metadata: {
        bookingId: booking._id,
        userId: user._id,
        bookingType,
        bookingName,
        bookingDate,
        bookingTime,
      },
    });

    await createNotification({
      userId: user._id,
      audience: "member",
      type: "booking_submitted",
      title: "Booking Submitted",
      message: `Your booking for ${bookingName} on ${bookingDate} at ${bookingTime} is pending approval.`,
      metadata: {
        bookingId: booking._id,
        bookingType,
        bookingName,
      },
    });

    return res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// GET MY BOOKINGS
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });

    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    return res.status(200).json(bookings);
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId, status } = req.body;

    if (!bookingId || !status) {
      return res.status(400).json({
        message: "Booking ID and status are required",
      });
    }

    if (!["pending", "approved", "cancelled"].includes(status)) {
      return res.status(400).json({
        message: "Invalid booking status",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const previousStatus = booking.status;
    booking.status = status;
    await booking.save();

    // SMS to member when booking is approved or cancelled
try {
  const user = await User.findById(booking.userId);

  if (user?.mobileNumber) {
    let smsMessage = "";

    if (status === "approved") {
      smsMessage = `Gym Ravana: Your ${booking.bookingType} booking for ${booking.bookingName} on ${booking.bookingDate} at ${booking.bookingTime} has been approved.`;
    } else if (status === "cancelled") {
      smsMessage = `Gym Ravana: Your ${booking.bookingType} booking for ${booking.bookingName} on ${booking.bookingDate} at ${booking.bookingTime} has been cancelled.`;
    }

    if (smsMessage) {
      await sendSMS({
        phone: user.mobileNumber,
        message: smsMessage,
      });
    }
  }
} catch (smsError) {
  console.error("BOOKING SMS ERROR:", smsError.message);
}

    if (previousStatus !== status) {
      await createNotification({
        audience: "admin",
        type: "booking_status_updated",
        title: "Booking Status Updated",
        message: `${booking.userName} booking for ${booking.bookingName} is now ${status}.`,
        metadata: {
          bookingId: booking._id,
          userId: booking.userId,
          status,
        },
      });

      if (status === "approved") {
        await createNotification({
          userId: booking.userId,
          audience: "member",
          type: "booking_approved",
          title: "Booking Approved",
          message: `Your booking for ${booking.bookingName} on ${booking.bookingDate} at ${booking.bookingTime} has been approved.`,
          metadata: {
            bookingId: booking._id,
          },
        });
      }

      if (status === "cancelled") {
        await createNotification({
          userId: booking.userId,
          audience: "member",
          type: "booking_cancelled",
          title: "Booking Cancelled",
          message: `Your booking for ${booking.bookingName} on ${booking.bookingDate} at ${booking.bookingTime} has been cancelled.`,
          metadata: {
            bookingId: booking._id,
          },
        });
      }
    }

    return res.status(200).json({
      message: "Booking status updated successfully",
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus,
};