const crypto = require("crypto");
const { User } = require("../../models");
const transporter = require("../../config/email");
const { Op } = require("sequelize");
const { hash } = require("bcrypt");

// Handle POST /forgot-password
exports.requestReset = async (req, res, next) => {
  const { email } = req.body;
  const genericMessage =
    "If that email exists in our system, we have sent a password reset link.";

  try {
    const user = await User.findOne({ where: { email, isDeleted: false } });

    if (user) {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString("hex");
      // Hash the token before storing (for extra security)
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Set expiration (1 hour from now)
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await user.update({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expires,
      });

      // Build reset link
      const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

      // Send email with modern design
      await transporter.sendMail({
        from: `"PostLoop Support" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Reset your PostLoop password",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your PostLoop password</title>
  <style>
    /* General styles */
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      padding: 0;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: white;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .logo span {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 40px;
    }
    .content {
      padding: 40px 32px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #0f172a;
    }
    .greeting {
      font-size: 18px;
      color: #1e293b;
      margin-bottom: 20px;
      font-weight: 500;
    }
    .message {
      font-size: 16px;
      line-height: 1.5;
      color: #334155;
      margin-bottom: 28px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: white !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      padding: 14px 32px;
      border-radius: 40px;
      margin: 8px 0 24px;
      box-shadow: 0 8px 18px rgba(14,165,233,0.25);
      transition: all 0.2s ease;
    }
    .button:hover {
      background: linear-gradient(135deg, #0284c7, #4f46e5);
      box-shadow: 0 12px 24px rgba(14,165,233,0.35);
      transform: translateY(-1px);
    }
    .expiry-note {
      font-size: 13px;
      color: #64748b;
      margin: 20px 0 0;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #0ea5e9;
      text-decoration: none;
    }
    @media only screen and (max-width: 560px) {
      .content {
        padding: 32px 24px;
      }
      .button {
        display: block;
        text-align: center;
      }
    }
  </style>
</head>
<body style="margin:0; padding:24px 16px; background-color:#f4f7fb;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr>
      <td align="center">
        <div class="container">
          <!-- Header with gradient -->
          <div class="header">
            <a href="${process.env.APP_URL}" class="logo" style="color:white; text-decoration:none;">
              <span>PostLoop</span>
            </a>
          </div>

          <!-- Main content -->
          <div class="content">
            <h1>Reset your password</h1>
            <div class="greeting">Hello ${user.name},</div>
            <div class="message">
              We received a request to reset the password for your PostLoop account.<br><br>
              Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.
            </div>

            <div style="text-align:center;">
              <a href="${resetUrl}" class="button">Reset password</a>
            </div>

            <div class="expiry-note">
              If you didn't request this, please ignore this email. Your password won't change until you create a new one.
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            &copy; 2025 PostLoop. All rights reserved.<br>
            <a href="${process.env.APP_URL}">Visit PostLoop</a> • 
            <a href="mailto:support@postloop.com">Contact support</a>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      });
    }

    // Always show the same message (prevents email enumeration)
    req.flash("success_msg", genericMessage);
    res.redirect("/login");
  } catch (error) {
    console.error("Password reset request error:", error);
    console.error(error.stack);
    req.flash("error_msg", "Something went wrong. Please try again later.");
    res.redirect("/forgot-password");
  }
};

// Handle POST /reset-password
exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body;

  if (!token || !password) {
    req.flash("error_msg", "Invalid request.");
    return res.redirect("/forgot-password");
  }

  try {
    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token (not expired)
    const user = await User.findOne({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      req.flash("error_msg", "Password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    // Hash the new password using bcrypt (as you already do)
    const hashedPassword = await hash(password, 10);

    // Update user and clear reset token fields
    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    // Optional: send confirmation email with matching design
    await transporter
      .sendMail({
        to: user.email,
        subject: "Your password has been changed",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password changed</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: white;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .logo span {
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 40px;
    }
    .content {
      padding: 40px 32px;
      text-align: center;
    }
    h2 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 16px;
      color: #0f172a;
    }
    p {
      font-size: 16px;
      line-height: 1.5;
      color: #334155;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #0ea5e9;
      text-decoration: none;
    }
  </style>
</head>
<body style="margin:0; padding:24px 16px; background-color:#f4f7fb;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr><td align="center">
      <div class="container">
        <div class="header">
          <a href="${process.env.APP_URL}" class="logo"><span>PostLoop</span></a>
        </div>
        <div class="content">
          <h2>Password changed</h2>
          <p>Hello ${user.name},</p>
          <p>Your PostLoop password was successfully changed. If this wasn't you, please contact support immediately.</p>
          <p> </p>
          <p>Thanks,<br>The PostLoop Team</p>
        </div>
        <div class="footer">
          &copy; 2025 PostLoop. All rights reserved.<br>
          <a href="${process.env.APP_URL}">Visit PostLoop</a> • 
          <a href="mailto:support@postloop.com">Contact support</a>
        </div>
      </div>
    </td></td>
  </table>
</body>
</html>
        `,
      })
      .catch(console.error); // Don't let email failure break the flow

    req.flash(
      "success_msg",
      "Your password has been reset. Please log in with your new password.",
    );
    res.redirect("/login");
  } catch (error) {
    console.error("Password reset error:", error);
    req.flash("error_msg", "Unable to reset password. Please try again.");
    res.redirect("/forgot-password");
  }
};

// Show forgot password form
exports.showForgotForm = (req, res) => {
  res.render("forgot-password", {
    title: "Forgot Password",
    user: req.user,
    pageCss: "auth.css",
  });
};

// Show reset password form (with token validation)
exports.showResetForm = (req, res) => {
  const { token } = req.query;
  if (!token) {
    req.flash("error_msg", "No token provided.");
    return res.redirect("/forgot-password");
  }
  res.render("reset-password", {
    title: "Reset Password",
    token,
    user: req.user,
    pageCss: "auth.css",
  });
};
