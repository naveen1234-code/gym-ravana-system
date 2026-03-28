require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const runMembershipCron = require("./src/cron/membershipCron");
const runGymAutoExitCron = require("./src/cron/startGymAutoExitCron");

const PORT = process.env.PORT || 5000;

// CONNECT DB
connectDB();

// START CRON
runMembershipCron();
runGymAutoExitCron();

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});