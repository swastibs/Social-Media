/**
 * Razorpay Configuration
 *
 * Initializes the Razorpay instance with API keys from environment variables.
 * Used for creating orders and verifying payments.
 */

const Razorpay = require("razorpay");

// Create Razorpay instance with test/live keys from .env
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpayInstance;
