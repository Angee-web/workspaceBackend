const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);
router.post("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerificationEmail);

// Protected routes
router.get("/me", auth, authController.getCurrentUser);
router.put("/update-password", auth, authController.updatePassword);
router.put("/update-profile", auth, authController.updateProfile);

module.exports = router;
