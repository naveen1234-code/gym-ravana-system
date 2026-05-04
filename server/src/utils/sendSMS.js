const axios = require("axios");

const normalizeSriLankanPhone = (phone) => {
  if (!phone) return null;

  const raw = String(phone).trim();

  // Supports cases like: 0774498800/0716209087
  const candidates = raw
    .split(/[\/,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    let cleaned = candidate.replace(/\s+/g, "");

    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }

    // Remove non-digits after handling +
    cleaned = cleaned.replace(/\D/g, "");

    // 0771234567 -> 94771234567
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = `94${cleaned.substring(1)}`;
    }

    // 771234567 -> 94771234567
    if (cleaned.startsWith("7") && cleaned.length === 9) {
      cleaned = `94${cleaned}`;
    }

    // Notify.lk expected format: 9471XXXXXXX
    if (/^94\d{9}$/.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
};

const sendSMS = async ({ phone, message }) => {
  try {
    if (!phone || !message) {
      console.error("SMS ERROR: Missing phone or message");
      return false;
    }

    const cleanedPhone = normalizeSriLankanPhone(phone);

    if (!cleanedPhone) {
      console.error("SMS ERROR: Invalid phone number:", phone);
      return false;
    }

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

    const response = await axios.get(process.env.SMS_API_URL, {
      params: {
        user_id: process.env.SMS_USER_ID,
        api_key: process.env.SMS_API_KEY,
        sender_id: process.env.SMS_SENDER_ID,
        to: cleanedPhone,
        message,
      },
      timeout: 20000,
    });

    console.log("SMS Provider Response:", response.data);

    const providerStatus = String(response.data?.status || "").toLowerCase();
    const providerData = String(response.data?.data || "").toLowerCase();

    const accepted =
      providerStatus === "success" &&
      providerData.includes("sent");

    if (!accepted) {
      console.error("SMS NOT ACCEPTED BY PROVIDER:", {
        phone: cleanedPhone,
        response: response.data,
      });
      return false;
    }

    console.log(`✅ SMS ACCEPTED BY PROVIDER to ${cleanedPhone}`);
    return true;
  } catch (error) {
    console.error("SMS ERROR:", error.response?.data || error.message);
    return false;
  }
};

module.exports = sendSMS;