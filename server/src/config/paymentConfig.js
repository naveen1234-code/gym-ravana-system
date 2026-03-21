const paymentConfig = {
  merchantId: process.env.PAYHERE_MERCHANT_ID || "",
  secret: process.env.PAYHERE_SECRET || "",
  returnUrl: process.env.PAYHERE_RETURN_URL || "",
  cancelUrl: process.env.PAYHERE_CANCEL_URL || "",
  notifyUrl: process.env.PAYHERE_NOTIFY_URL || "",
};

module.exports = paymentConfig;