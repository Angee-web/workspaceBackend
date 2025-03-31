const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const auth = require("../middleware/auth");
const { isAdmin, isEmployer } = require("../middleware/permissions");

// All routes require authentication
router.use(auth);

// Routes based on role
router.get("/history", paymentController.getPaymentHistory);
router.get("/stats", paymentController.getPaymentStats);

// Employee routes
router.get("/employee", paymentController.getEmployeePayments);

// Employer routes
router.use("/company", isEmployer);
router.get("/company", paymentController.getCompanyPayments);
router.post("/company/approve/:id", paymentController.approvePayment);
router.post("/company/decline/:id", paymentController.declinePayment);

// Admin routes
router.use("/admin", isAdmin);
router.post("/admin/process-daily", paymentController.processDailyPayments);
router.get("/admin/pending-review", paymentController.getPendingReviewPayments);
router.post("/admin/finalize", paymentController.finalizePayment);

// Paystack webhook
router.post("/webhooks/paystack", paymentController.paystackWebhook);

module.exports = router;
