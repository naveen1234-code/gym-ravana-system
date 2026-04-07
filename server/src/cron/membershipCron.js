const cron = require("node-cron");
const User = require("../models/User");
const createNotification = require("../utils/createNotification");
const sendSMS = require("../utils/sendSMS");

const SRI_LANKA_TZ = "Asia/Colombo";

const getSriLankaDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SRI_LANKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
};

const getSriLankaDayOfWeek = (date = new Date()) => {
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: SRI_LANKA_TZ,
    weekday: "short",
  }).format(date);

  const map = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[dayName];
};

const ensureNotificationFlags = (user) => {
  if (!user.notificationFlags) {
    user.notificationFlags = {
      warning7: false,
      warning3: false,
      warning1: false,
      expired: false,
    };
  }
};

const processMembershipsForToday = async () => {
  console.log("⏰ Running membership closing-time deduction check...");

  try {
    const now = new Date();
    const dayOfWeek = getSriLankaDayOfWeek(now);
    const todayKey = getSriLankaDateKey(now);

    // Skip Sunday fully
    if (dayOfWeek === 0) {
      console.log("🛑 Sunday detected - skipping membership deduction");
      return;
    }

    const users = await User.find({
      membershipStatus: "active",
    });

    for (const user of users) {
      ensureNotificationFlags(user);

      const lastDeductedKey = user.lastDayDeductedAt
        ? getSriLankaDateKey(user.lastDayDeductedAt)
        : null;

      const alreadyDeductedToday = lastDeductedKey === todayKey;

      // Deduct only if today was not already used by QR entry
      if (!alreadyDeductedToday && user.remainingDays > 0) {
        user.remainingDays = Math.max((user.remainingDays || 0) - 1, 0);
        user.lastDayDeductedAt = now;
      }

      if (user.remainingDays < 0) {
        user.remainingDays = 0;
      }

      const daysLeft = user.remainingDays;

      if (daysLeft === 7 && !user.notificationFlags.warning7) {
        await createNotification({
          userId: user._id,
          audience: "member",
          type: "expiry_warning_7",
          title: "Membership Expiring Soon",
          message: "Your membership will expire in 7 days.",
          metadata: {
            userId: user._id,
            daysLeft: 7,
          },
        });

        await createNotification({
          audience: "admin",
          type: "member_expiry_warning_7",
          title: "Member Expiring Soon",
          message: `${user.fullName || user.name} membership will expire in 7 days.`,
          metadata: {
            userId: user._id,
            daysLeft: 7,
          },
        });

        try {
          if (user.mobileNumber) {
            await sendSMS({
              phone: user.mobileNumber,
              message:
                "Gym Ravana: Your membership expires in 7 days. Renew early to avoid interruption.",
            });
          }
        } catch (smsError) {
          console.error("7 DAY MEMBER SMS ERROR:", smsError.message);
        }

        try {
          if (process.env.ADMIN_MOBILE_NUMBER) {
            await sendSMS({
              phone: process.env.ADMIN_MOBILE_NUMBER,
              message: `Gym Ravana Admin: ${user.fullName || user.name} membership expires in 7 days.`,
            });
          }
        } catch (smsError) {
          console.error("7 DAY ADMIN SMS ERROR:", smsError.message);
        }

        user.notificationFlags.warning7 = true;
      }

      if (daysLeft === 3 && !user.notificationFlags.warning3) {
        await createNotification({
          userId: user._id,
          audience: "member",
          type: "expiry_warning_3",
          title: "Membership Expiring Soon",
          message: "Your membership will expire in 3 days.",
          metadata: {
            userId: user._id,
            daysLeft: 3,
          },
        });

        await createNotification({
          audience: "admin",
          type: "member_expiry_warning_3",
          title: "Member Expiring Soon",
          message: `${user.fullName || user.name} membership will expire in 3 days.`,
          metadata: {
            userId: user._id,
            daysLeft: 3,
          },
        });

        try {
          if (user.mobileNumber) {
            await sendSMS({
              phone: user.mobileNumber,
              message:
                "Gym Ravana: Your membership expires in 3 days. Please renew soon.",
            });
          }
        } catch (smsError) {
          console.error("3 DAY MEMBER SMS ERROR:", smsError.message);
        }

        try {
          if (process.env.ADMIN_MOBILE_NUMBER) {
            await sendSMS({
              phone: process.env.ADMIN_MOBILE_NUMBER,
              message: `Gym Ravana Admin: ${user.fullName || user.name} membership expires in 3 days.`,
            });
          }
        } catch (smsError) {
          console.error("3 DAY ADMIN SMS ERROR:", smsError.message);
        }

        user.notificationFlags.warning3 = true;
      }

      if (daysLeft === 1 && !user.notificationFlags.warning1) {
        await createNotification({
          userId: user._id,
          audience: "member",
          type: "expiry_warning_1",
          title: "Final Warning ⚠️",
          message: "Your membership expires tomorrow.",
          metadata: {
            userId: user._id,
            daysLeft: 1,
          },
        });

        await createNotification({
          audience: "admin",
          type: "member_expiry_warning_1",
          title: "Member Expiring Tomorrow",
          message: `${user.fullName || user.name} membership expires tomorrow.`,
          metadata: {
            userId: user._id,
            daysLeft: 1,
          },
        });

        try {
          if (user.mobileNumber) {
            await sendSMS({
              phone: user.mobileNumber,
              message:
                "Gym Ravana: Your membership expires tomorrow. Renew now to keep access active.",
            });
          }
        } catch (smsError) {
          console.error("1 DAY MEMBER SMS ERROR:", smsError.message);
        }

        try {
          if (process.env.ADMIN_MOBILE_NUMBER) {
            await sendSMS({
              phone: process.env.ADMIN_MOBILE_NUMBER,
              message: `Gym Ravana Admin: ${user.fullName || user.name} membership expires tomorrow.`,
            });
          }
        } catch (smsError) {
          console.error("1 DAY ADMIN SMS ERROR:", smsError.message);
        }

        user.notificationFlags.warning1 = true;
      }

      if (daysLeft <= 0 && !user.notificationFlags.expired) {
        user.membershipStatus = "expired";

        await createNotification({
          userId: user._id,
          audience: "member",
          type: "membership_expired",
          title: "Membership Expired",
          message: "Your membership has expired. Please renew.",
          metadata: {
            userId: user._id,
          },
        });

        await createNotification({
          audience: "admin",
          type: "member_expired",
          title: "Member Expired",
          message: `${user.fullName || user.name} membership has expired.`,
          metadata: {
            userId: user._id,
          },
        });

        try {
          if (user.mobileNumber) {
            await sendSMS({
              phone: user.mobileNumber,
              message:
                "Gym Ravana: Your membership has expired. Please renew to continue access.",
            });
          }
        } catch (smsError) {
          console.error("EXPIRED MEMBER SMS ERROR:", smsError.message);
        }

        try {
          if (process.env.ADMIN_MOBILE_NUMBER) {
            await sendSMS({
              phone: process.env.ADMIN_MOBILE_NUMBER,
              message: `Gym Ravana Admin: ${user.fullName || user.name} membership has expired.`,
            });
          }
        } catch (smsError) {
          console.error("EXPIRED ADMIN SMS ERROR:", smsError.message);
        }

        user.notificationFlags.expired = true;
      }

      await user.save();
    }

    console.log("✅ Membership closing-time deduction check completed");
  } catch (error) {
    console.error("❌ Membership cron error:", error.message);
  }
};

const runMembershipCron = () => {
  // Monday to Friday - 11:30 PM Sri Lanka local intent
  cron.schedule("30 23 * * 1-5", processMembershipsForToday);

  // Saturday - 10:30 PM Sri Lanka local intent
  cron.schedule("30 22 * * 6", processMembershipsForToday);
};

module.exports = runMembershipCron;