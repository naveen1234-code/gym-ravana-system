const axios = require("axios");

const sendSMS = async ({ phone, message }) => {
  try {
    if (!phone || !message) {
      console.error("SMS ERROR: Missing phone or message");
      return false;
    }

    // ✅ Clean phone number
    let cleanedPhone = String(phone).trim().replace(/\s+/g, "");

    // Convert Sri Lankan local format to international
    // Example: 0771234567 -> 94771234567
    if (cleanedPhone.startsWith("0")) {
      cleanedPhone = "94" + cleanedPhone.substring(1);
    }

    // Remove +
    if (cleanedPhone.startsWith("+")) {
      cleanedPhone = cleanedPhone.substring(1);
    }

    // 🚫 If SMS provider not configured, don't crash system
    if (
      !process.env.SMS_API_URL ||
      !process.env.SMS_USER_ID ||
      !process.env.SMS_API_KEY ||
      !process.env.SMS_SENDER_ID
    ) {
      console.log("⚠️ SMS provider not configured yet");
      console.log(`📱 SMS READY -> ${cleanedPhone}: ${message}`);
      return false;
    }

    // 🔥 REAL SMS REQUEST
    const response = await axios.post(
      process.env.SMS_API_URL,
      {
        user_id: process.env.SMS_USER_ID,
        api_key: process.env.SMS_API_KEY,
        sender_id: process.env.SMS_SENDER_ID,
        to: cleanedPhone,
        message,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ SMS SENT to ${cleanedPhone}`);
    console.log("SMS Provider Response:", response.data);

    return true;
  } catch (error) {
    console.error(
      "SMS ERROR:",
      error.response?.data || error.message
    );
    return false;
  }
};

module.exports = sendSMS;