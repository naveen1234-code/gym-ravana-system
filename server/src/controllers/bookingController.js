const Booking = require("../models/Booking");
const User = require("../models/User");

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

    // 🚫 PREVENT DOUBLE BOOKING (same user, same slot)
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

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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

    booking.status = status;
    await booking.save();

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