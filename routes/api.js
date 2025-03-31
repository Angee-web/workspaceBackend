const express = require("express");
const router = express.Router();

// Import all route modules
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");
const employerRoutes = require("./employerRoutes");
const employeeRoutes = require("./employeeRoutes");
const projectRoutes = require("./projectRoutes");
const paymentRoutes = require("./paymentRoutes");

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Mount routes
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/employer", employerRoutes);
router.use("/employee", employeeRoutes);
router.use("/projects", projectRoutes);
router.use("/payments", paymentRoutes);

// Public jobs API endpoint (for job seekers)
router.get("/jobs", require("../controllers/employerController").getPublicJobs);
router.get(
  "/jobs/:id",
  require("../controllers/employerController").getPublicJobById
);
router.post(
  "/jobs/:id/apply",
  require("../controllers/employerController").applyForJob
);

// Interview responses for job applicants (no auth required)
router.get(
  "/interviews/:id/questions",
  require("../controllers/employerController").getInterviewQuestions
);
router.post(
  "/interviews/:id/submit",
  require("../middleware/upload").single("videoResponse"),
  require("../controllers/employerController").submitInterviewResponse
);

module.exports = router;
