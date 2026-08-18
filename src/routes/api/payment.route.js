const express = require("express");
const paymentRouter = express.Router();
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  createOrder,
  verifyPayment,
} = require("../../controllers/api/payment.controller");

paymentRouter.post("/create-order", authenticate, createOrder);
paymentRouter.post("/verify-payment", authenticate, verifyPayment);

module.exports = paymentRouter;
