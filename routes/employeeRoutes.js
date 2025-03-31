const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const auth = require("../middleware/auth");
const { isEmployee } = require("../middleware/permissions");
const upload = require("../middleware/upload");

// All routes require employee authentication
router.use(auth);
router.use(isEmployee);

// Profile management
router.get("/profile", employeeController.getProfile);
router.put("/profile", employeeController.updateProfile);
router.put("/profile/phone", employeeController.updatePhoneNumber);

// Document uploads
router.post(
  "/documents/nin",
  upload.single("ninDocument"),
  employeeController.uploadNIN
);
router.post(
  "/documents/utility",
  upload.single("utilityBill"),
  employeeController.uploadUtilityBill
);
router.post(
  "/documents/other",
  upload.single("document"),
  employeeController.uploadOtherDocument
);
router.get("/documents", employeeController.getDocuments);

// Remittance information
router.post("/remittance", employeeController.updateRemittanceInfo);
router.get("/remittance", employeeController.getRemittanceInfo);

// Attendance
router.post("/attendance/clock-in", employeeController.clockIn);
router.post("/attendance/clock-out", employeeController.clockOut);
router.get("/attendance", employeeController.getAttendanceHistory);

// Projects
router.get("/projects", employeeController.getAssignedProjects);
router.get("/projects/:id", employeeController.getProjectById);
router.post("/projects/:id/progress", employeeController.updateProjectProgress);
router.post("/projects/:id/complete", employeeController.markProjectComplete);

// Payments
router.get("/payments", employeeController.getPaymentHistory);

// Daily reports
router.post("/daily-report", employeeController.submitDailyReport);
router.get("/daily-reports", employeeController.getDailyReports);

// Face recognition
router.post(
  "/face-capture",
  upload.single("faceImage"),
  employeeController.captureFaceImage
);

module.exports = router;
