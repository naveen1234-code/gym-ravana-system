const cron = require("node-cron");
const User = require("../models/User");
const createNotification = require("../utils/createNotification");

const runGymAutoExitCron = () => {
  // Monday to Friday - 10:15 PM
  cron.schedule("15 22 * * 1-5", async () => {
    console.log("🏁 Running weekday gym auto-exit...");

    try {
      const insideUsers = await User.find({
        isInsideGym: true,
      });

      for (const user of insideUsers) {
        user.isInsideGym = false;
        user.lastExitAt = new Date();

        await createNotification({
          audience: "admin",
          type: "auto_exit_after_closing",
          title: "Member Auto Exited",
          message: `${user.fullName || user.name} was automatically checked out after closing time.`,
          metadata: {
            userId: user._id,
            reason: "Auto exit after gym closing time",
          },
        });

        await user.save();
      }

      console.log(`✅ Weekday auto-exit completed for ${insideUsers.length} member(s)`);
    } catch (error) {
      console.error("❌ Weekday auto-exit cron error:", error.message);
    }
  });

  // Saturday - 8:15 PM
  cron.schedule("15 20 * * 6", async () => {
    console.log("🏁 Running Saturday gym auto-exit...");

    try {
      const insideUsers = await User.find({
        isInsideGym: true,
      });

      for (const user of insideUsers) {
        user.isInsideGym = false;
        user.lastExitAt = new Date();

        await createNotification({
          audience: "admin",
          type: "auto_exit_after_closing",
          title: "Member Auto Exited",
          message: `${user.fullName || user.name} was automatically checked out after closing time.`,
          metadata: {
            userId: user._id,
            reason: "Auto exit after gym closing time",
          },
        });

        await user.save();
      }

      console.log(`✅ Saturday auto-exit completed for ${insideUsers.length} member(s)`);
    } catch (error) {
      console.error("❌ Saturday auto-exit cron error:", error.message);
    }
  });
};

module.exports = runGymAutoExitCron;