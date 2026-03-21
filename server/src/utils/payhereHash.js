const crypto = require("crypto");
const paymentConfig = require("../config/paymentConfig");

const generatePayHereHash = ({
  orderId,
  amount,
  currency = "LKR",
}) => {
  const merchantId = paymentConfig.merchantId;
  const merchantSecret = paymentConfig.secret;

  if (!merchantId || !merchantSecret) {
    return "";
  }

  const formattedAmount = Number(amount).toFixed(2);

  const hashedSecret = crypto
    .createHash("md5")
    .update(merchantSecret)
    .digest("hex")
    .toUpperCase();

  const hashString =
    merchantId + orderId + formattedAmount + currency + hashedSecret;

  const hash = crypto
    .createHash("md5")
    .update(hashString)
    .digest("hex")
    .toUpperCase();

  return hash;
};

module.exports = generatePayHereHash;