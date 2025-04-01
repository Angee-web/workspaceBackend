require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/database");


// Set up uncaught exception handler
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

// Create HTTP server
const server = http.createServer(app);

// Set port
const PORT = process.env.PORT || 5000;

// Start server
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);

  // Log important environment variables without exposing sensitive data
 connectDB().then(() => console.log("Database connected successfully"));

  console.log(
    `Email service configured: ${process.env.EMAIL_HOST ? "Yes" : "No"}`
  );
  console.log(
    `Paystack integration: ${process.env.PAYSTACK_SECRET_KEY ? "Yes" : "No"}`
  );
  console.log(
    `Cloudinary integration: ${
      process.env.CLOUDINARY_CLOUD_NAME ? "Yes" : "No"
    }`
  );
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (err) => {
  console.error("UNHANDLED REJECTION! Attempting graceful recovery...");
  console.error(err.name, err.message);

  try {
    await connectDB(); // Attempt to reconnect
  } catch (dbErr) {
    console.error("Database reconnection failed. Shutting down...");
    server.close(() => process.exit(1));
  }
});


// Handle SIGTERM signal (e.g. Heroku shutdown)
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated.");
  });
});
