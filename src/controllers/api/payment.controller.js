const crypto = require("crypto");
const razorpayInstance = require("../../config/razorpay");
const { Payment, User } = require("../../models");
const ApiError = require("../../utils/ApiError");
const { successResponse } = require("../../utils/ApiResponse");
const { deleteByPattern } = require("../../utils/cache");

// @desc    Create a Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const amount = 50000; // Amount in paise (e.g., ₹500.00)

    const options = {
      amount: amount,
      currency: "INR",
      receipt: `receipt_order_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
      },
    };

    const order = await razorpayInstance.orders.create(options);

    // Store order details in your database
    await Payment.create({
      userId,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: "created",
    });

    return successResponse(res, {
      message: "Order created successfully",
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment signature after frontend callback
// @route   POST /api/payments/verify-payment
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    console.log("=== VERIFY PAYMENT CALLED ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const userId = req.user.id;
    console.log("User ID from token:", userId);

    const paymentRecord = await Payment.findOne({
      where: { razorpayOrderId: razorpay_order_id },
    });
    if (!paymentRecord) {
      throw new ApiError(404, "Payment record not found");
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await paymentRecord.update({
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "failed",
      });
      throw new ApiError(400, "Invalid payment signature");
    }

    await paymentRecord.update({
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "paid",
    });

    // Update user
    const user = await User.findByPk(userId);
    if (!user) throw new ApiError(404, "User not found");
    user.isVerified = true;
    await user.save();
    console.log(`User ${userId} verification status updated to true`);

    // ✅ Invalidate profile page cache for this user
    await deleteByPattern(`web:cache:/profile/${userId}*`);
    console.log(`Profile cache invalidated for user ${userId}`);

    return successResponse(res, {
      message: "Payment verified successfully. You are now a verified user!",
    });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);
    next(error);
  }
};

// @desc    Webhook to handle asynchronous payment events
// @route   POST /api/payments/webhook
// @access  Public (but signature verified)
exports.razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  // Verify webhook signature
  const generatedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (generatedSignature !== signature) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body;
  console.log("Webhook received:", event.event);

  try {
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;

      // Update payment record in your database
      const paymentRecord = await Payment.findOne({
        where: { razorpayOrderId: orderId },
      });
      if (paymentRecord && paymentRecord.status !== "paid") {
        await paymentRecord.update({
          razorpayPaymentId: paymentId,
          status: "paid",
          paymentMethod: payment.method,
          paymentDetails: JSON.stringify(payment),
        });

        // Mark user as verified (if not already)
        await User.update(
          { isVerified: true },
          { where: { id: paymentRecord.userId } },
        );
      }
    }
    res.status(200).send("Webhook processed");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).send("Webhook processing failed");
  }
};
