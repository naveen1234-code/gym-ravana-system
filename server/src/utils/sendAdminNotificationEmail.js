const nodemailer = require("nodemailer");

const sendAdminNotificationEmail = async ({
  subject,
  html,
  attachments = [],
}) => {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPass = process.env.SMTP_PASS;

  if (!adminEmail || !smtpEmail || !smtpPass) {
    throw new Error("Missing email environment variables");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: smtpEmail,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.sendMail({
    from: `"GYM RAVANA" <${smtpEmail}>`,
    to: adminEmail,
    subject,
    html,
    attachments,
  });
};

module.exports = sendAdminNotificationEmail;