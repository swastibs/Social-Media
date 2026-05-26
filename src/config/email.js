/**
 * Email Configuration (Nodemailer)
 *
 * Sets up the SMTP transporter for sending emails.
 * Used for password reset emails and account notifications.
 */

const nodemailer = require("nodemailer");

// Create transporter using SMTP settings from .env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: false, // Use TLS (true for port 465, false for 587)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates (for development)
  },
});

// Verify SMTP connection configuration
transporter.verify((error, success) => {
  if (error) console.error("❌ SMTP connection error:", error.message);
  else console.log("✅ SMTP server is ready to send emails");
});

module.exports = transporter;
