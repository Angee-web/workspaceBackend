const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Middleware to verify JWT token and attach user to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "No authentication token provided" });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if token is in user's tokens list (if you maintain a tokens array)
    // This would be useful for implementing token invalidation on logout

    // Attach user to request object
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    res.status(401).json({ message: "Authentication failed" });
  }
};

/**
 * Middleware to verify email authentication
 * Used for enforcing email verification on login
 */
const verifyEmail = async (req, res, next) => {
  try {
    // Check if user email is verified
    if (!req.user.emailVerified) {
      return res.status(403).json({
        message: "Email verification required",
        verificationRequired: true,
      });
    }
    next();
  } catch (error) {
    console.error("Email verification middleware error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { auth, verifyEmail };
