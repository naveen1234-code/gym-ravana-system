const paymentConfig = require("../config/paymentConfig");
const generatePayHereHash = require("./payhereHash");

const buildPayHereCheckoutData = ({
  orderId,
  user,
  planName,
  amount,
}) => {
  const currency = "LKR";

  const hash = generatePayHereHash({
    orderId,
    amount,
    currency,
  });

  return {
    sandbox: true,
    merchant_id: paymentConfig.merchantId,
    return_url: paymentConfig.returnUrl,
    cancel_url: paymentConfig.cancelUrl,
    notify_url: paymentConfig.notifyUrl,
    order_id: orderId,
    items: planName,
    currency,
    amount: Number(amount).toFixed(2),
    first_name: user?.name || "Member",
    last_name: "",
    email: user?.email || "",
    phone: "0000000000",
    address: "GYM RAVANA",
    city: "Kiribathgoda",
    country: "Sri Lanka",
    hash,
  };
};

module.exports = buildPayHereCheckoutData;