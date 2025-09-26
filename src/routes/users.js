var express = require("express");
var router = express.Router();
const { User, EntityWhoFoundArticle } = require("newsnexusdb09");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

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

	try {
		const user = await User.findOne({ where: { email } });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
			expiresIn: "5h",
		});
		// Reset link
		const resetLink = `${process.env.URL_KV_MANAGER_WEBSITE}/forgot-password/reset/${token}`;

		// Send email
		await sendResetPasswordEmail(email, resetLink)
			.then(() => console.log("Email sent successfully"))
			.catch((error) => console.error("Email failed:", error));

		res.json({ message: "Password reset email sent" });
	} catch (error) {
		res.status(500).json({ error: "Server error" });
	}
});

router.post("/reset-password/:token", async (req, res) => {
	const token = req.params.token;
	const { password } = req.body;

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findByPk(decoded.id);

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		await user.update({ password: hashedPassword });

		res.json({ message: "Password reset successfully" });
	} catch (error) {
		res.status(500).json({ error: "Server error" });
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
