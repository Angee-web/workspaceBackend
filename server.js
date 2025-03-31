require("dotenv").config();
const http = require("http");
const app = require("./app");

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
  console.log(`Database connected: ${process.env.MONGO_URI ? "Yes" : "No"}`);
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
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal (e.g. Heroku shutdown)
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated.");
  });
});
