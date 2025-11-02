// require("dotenv").config();
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Create a transporter for Microsoft 365 (Office 365) SMTP
const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS,
    pass: process.env.ADMIN_NODEMAILER_EMAIL_PASSWORD,
  },
});

/**
 * Validates email configuration
 * @throws {Error} If email credentials are not configured
 */
const validateEmailConfig = () => {
  if (
    !process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS ||
    !process.env.ADMIN_NODEMAILER_EMAIL_PASSWORD
  ) {
    const missing = [];
    if (!process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS)
      missing.push("ADMIN_NODEMAILER_EMAIL_ADDRESS");
    if (!process.env.ADMIN_NODEMAILER_EMAIL_PASSWORD)
      missing.push("ADMIN_NODEMAILER_EMAIL_PASSWORD");

    throw new Error(
      `Email configuration error: Missing required environment variables: ${missing.join(
        ", "
      )}. ` +
        `Please configure these in your .env file to enable email functionality.`
    );
  }
};

const sendRegistrationEmail = async (toEmail, username) => {
  try {
    const templatePath = path.join(
      __dirname,
      "../templates/registrationConfirmationEmail.html"
    );

    // Read the external HTML file
    let emailTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace the placeholder {{username}} with the actual username
    emailTemplate = emailTemplate.replace("{{username}}", username);

    const mailOptions = {
      from: process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS,
      to: toEmail,
      subject: "Confirmation: Kyber Vision Registration ",
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

const sendResetPasswordEmail = async (toEmail, resetLink) => {
  console.log(`- Sending reset password email to: ${toEmail}`);

  console.log(
    "[MAILER DEBUG] ADMIN_NODEMAILER_EMAIL_ADDRESS:",
    process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS
  );
  console.log("[MAILER DEBUG] NODE_ENV:", process.env.NODE_ENV);

  try {
    // Validate configuration before attempting to send
    validateEmailConfig();

    const templatePath = path.join(
      __dirname,
      "../templates/resetPasswordLinkEmail.html"
    );

    // Read the external HTML file
    let emailTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace the placeholder {{username}} with the actual username
    emailTemplate = emailTemplate.replace("{{resetLink}}", resetLink);

    const mailOptions = {
      from: process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS,
      to: toEmail,
      subject: "Password Reset Request",
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Password reset email sent successfully:`, info.response);
    return info;
  } catch (error) {
    // Enhanced error logging with context
    console.error("❌ [MAILER DEBUG] Error type:", typeof error);
    console.error("❌ [MAILER DEBUG] Error is null/undefined?", error == null);
    console.error(
      "❌ [MAILER DEBUG] Error stringified:",
      JSON.stringify(error, null, 2)
    );
    console.error("❌ [MAILER DEBUG] Error toString:", String(error));
    console.error("❌ [MAILER DEBUG] Error.message:", error?.message);
    console.error("❌ [MAILER DEBUG] Error.code:", error?.code);
    console.error("❌ [MAILER DEBUG] Full error:", error);
    console.error(
      "❌ [MAILER DEBUG] ADMIN_NODEMAILER_EMAIL_ADDRESS:",
      process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS
    );
    console.log("❌ [MAILER DEBUG] NODE_ENV:", process.env.NODE_ENV);

    if (error?.message && error.message.includes("Email configuration error")) {
      console.error("❌ EMAIL CONFIGURATION ERROR:", error.message);
    } else if (error?.code === "EAUTH") {
      console.error(
        "❌ EMAIL AUTHENTICATION FAILED: Invalid ADMIN_NODEMAILER_EMAIL_ADDRESS or ADMIN_NODEMAILER_EMAIL_PASSWORD. " +
          "Please verify your Gmail credentials in .env file."
      );
    } else if (error?.code === "ENOTFOUND" || error?.code === "ECONNECTION") {
      console.error(
        "❌ EMAIL NETWORK ERROR: Cannot reach Gmail SMTP server.",
        error?.message
      );
    } else {
      console.error("❌ EMAIL SEND ERROR:", error?.message || "Unknown error");
    }

    throw error; // Re-throw for route handler to catch
  }
};

module.exports = {
  sendRegistrationEmail,
  sendResetPasswordEmail,
};
