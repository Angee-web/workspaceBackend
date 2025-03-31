const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const { isAdmin } = require("../middleware/permissions");

// All routes require admin authentication
router.use(auth);
router.use(isAdmin);

// Company management
router.post("/companies", adminController.createCompany);
router.get("/companies", adminController.getAllCompanies);
router.get("/companies/:id", adminController.getCompanyById);
router.put("/companies/:id", adminController.updateCompany);
router.delete("/companies/:id", adminController.deleteCompany);

// User management
router.get("/users", adminController.getAllUsers);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.post("/users/create-employer", adminController.createEmployer);

// Payment review
router.get(
  "/payments/pending-review",
  adminController.getPendingReviewPayments
);
router.post("/payments/review", adminController.reviewPayment);

// Dashboard and analytics
router.get("/dashboard", adminController.getDashboardStats);
router.get("/analytics/users", adminController.getUserAnalytics);
router.get("/analytics/payments", adminController.getPaymentAnalytics);

module.exports = router;
