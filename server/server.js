const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const runMembershipCron = require("./src/cron/membershipCron");
const runGymAutoExitCron = require("./src/cron/startGymAutoExitCron");

const PORT = process.env.PORT || 5000;

// CONNECT DB
connectDB().then(() => {
  // START CRON only after DB is connected
  runMembershipCron();
  runGymAutoExitCron();

  // START SERVER
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});