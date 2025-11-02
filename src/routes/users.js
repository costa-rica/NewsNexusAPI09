var express = require("express");
var router = express.Router();
const { User, EntityWhoFoundArticle } = require("newsnexusdb09");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");
const { sendResetPasswordEmail } = require("../modules/mailer");

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

// 🔹 POST /users/register: Register User (Create)
router.post("/register", async (req, res) => {
  const { password, email } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "password",
    "email",
  ]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username: email.split("@")[0],
    password: hashedPassword,
    email,
    created: new Date(),
  });

  // Create EntityWhoFoundArticle record for the admin user
  await EntityWhoFoundArticle.create({
    userId: user.id,
  });

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

  res.status(201).json({
    message: "User created successfully",
    token,
    user: { username: user.username, email: user.email },
  });
});

// 🔹 POST /users/login: Login User (Read)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "email",
    "password",
  ]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  res.json({
    message: "User logged in successfully",
    token,
    user: { username: user.username, email: user.email, isAdmin: user.isAdmin },
  });
  // res.status(500).json({ error: "Testing this error" });
});

// 🔹 POST /users/request-password-reset: Send reset token
router.post("/request-password-reset", async (req, res) => {
  const { email } = req.body;
  console.log(`- in POST /users/request-password-reset for email: ${email}`);

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ result: false, message: "User not found" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "5h",
    });
    // Reset link
    const resetLink = `${process.env.URL_BASE_TO_WEBSITE}/forgot-password/reset/${token}`;

    // Send email - let errors propagate to catch block
    await sendResetPasswordEmail(email, resetLink);

    console.log(`✓ Password reset email sent successfully to ${email}`);
    res.json({ result: true, message: "Password reset email sent" });
  } catch (error) {
    console.error(
      `❌ [ROUTE DEBUG] Error in /request-password-reset for ${email}:`,
      {
        message: error.message,
        code: error.code,
        stack: error.stack,
      }
    );

    // Provide specific error responses based on error type
    if (error.message && error.message.includes("Email configuration error")) {
      return res.status(503).json({
        result: false,
        error:
          "Email service is not configured. Please contact the administrator.",
      });
    } else if (error.code === "EAUTH") {
      return res.status(503).json({
        result: false,
        error:
          "Email service authentication failed. Please contact the administrator.",
      });
    } else {
      return res.status(500).json({
        result: false,
        error: "Failed to send password reset email. Please try again later.",
      });
    }
  }
});

// 🔹 POST /users/reset-password/:token: Reset password
router.post("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  console.log(`- in POST /users/reset-password/:token`);
  console.log(`  Token received: ${token.substring(0, 20)}...`);
  console.log(`  Request body:`, req.body);

  const { newPassword } = req.body;
  console.log(`  Password received: ${newPassword ? "Yes" : "No"}`);

  // Validate password is present
  if (!newPassword) {
    console.log(`  ❌ Password missing in request body`);
    return res.status(400).json({
      result: false,
      error: "Password is required",
    });
  }

  try {
    console.log(`  Verifying JWT token...`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`  Token decoded successfully. User ID:`, decoded.id);

    console.log(`  Looking up user with ID: ${decoded.id}`);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      console.log(`  ❌ User not found with ID: ${decoded.id}`);
      return res.status(404).json({ result: false, message: "User not found" });
    }

    console.log(`  User found: ${user.email}`);
    console.log(`  Hashing new password...`);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log(`  Updating user password...`);
    await user.update({ password: hashedPassword });

    console.log(`  ✓ Password reset successfully for user: ${user.email}`);
    res.json({ result: true, message: "Password reset successfully" });
  } catch (error) {
    console.error(`  ❌ Error in /reset-password/:token:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    if (error.name === "JsonWebTokenError") {
      return res.status(400).json({
        result: false,
        error: "Invalid reset token",
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        result: false,
        error: "Reset token has expired. Please request a new password reset.",
      });
    }

    res.status(500).json({ result: false, error: "Server error" });
  }
});

// 🔹 Delete User by ID
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  await user.destroy();
  res.status(200).json({ message: "User deleted successfully" });
});

// 🔹 POST /update/:userId: Update User (PATCH-like behavior)
router.post(
  "/update/:userId",
  authenticateToken, // Ensure the user is authenticated
  async (req, res) => {
    const { userId } = req.params;
    const { username, password, email, isAdmin } = req.body;

    console.log(`Updating user ${userId}`);

    // Find the user by ID
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prepare update object (only include non-null fields)
    const updatedFields = {};
    if (username) updatedFields.username = username;
    if (email) updatedFields.email = email;
    if (typeof isAdmin === "boolean") {
      updatedFields.isAdmin = isAdmin;
    }

    // If password is provided, hash it before updating
    if (password) {
      updatedFields.password = await bcrypt.hash(password, 10);
    }

    // Perform the update if there are fields to update
    if (Object.keys(updatedFields).length > 0) {
      await user.update(updatedFields);
      console.log(`User ${userId} updated successfully`);
    } else {
      console.log(`No updates applied for user ${userId}`);
    }

    res.status(200).json({ message: "Mise à jour réussie.", user });
  }
);

module.exports = router;
