const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const accessRoutes = require("./routes/accessRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const galleryAdminRoutes = require("./routes/galleryAdminRoutes");

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// STATIC FILES
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/gallery-admin", galleryAdminRoutes);

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("GYM RAVANA backend is running ✅");
});

module.exports = app; s