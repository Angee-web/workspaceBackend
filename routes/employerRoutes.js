const express = require("express");
const router = express.Router();
const employerController = require("../controllers/employerController");
const auth = require("../middleware/auth");
const { isEmployer } = require("../middleware/permissions");
const upload = require("../middleware/upload");

// All routes require employer authentication
router.use(auth);
router.use(isEmployer);

// Company management
router.get("/company", employerController.getCompanyDetails);
router.put(
  "/company",
  upload.single("logo"),
  employerController.updateCompanyDetails
);
router.post("/company/balance", employerController.addCompanyBalance);

// Employee management
router.post("/employees/invite", employerController.inviteEmployee);
router.get("/employees", employerController.getAllEmployees);
router.get("/employees/:id", employerController.getEmployeeById);
router.put("/employees/:id", employerController.updateEmployee);
router.post("/employees/:id/terminate", employerController.terminateEmployee);
router.post(
  "/employees/:id/contract",
  employerController.generateEmploymentContract
);

// Working conditions
router.post("/employees/:id/working-days", employerController.setWorkingDays);
router.post("/employees/:id/break-time", employerController.setBreakTime);
router.post("/employees/:id/wages", employerController.setWages);

// Project management
router.post("/projects", employerController.createProject);
router.get("/projects", employerController.getAllProjects);
router.get("/projects/:id", employerController.getProjectById);
router.put("/projects/:id", employerController.updateProject);
router.delete("/projects/:id", employerController.deleteProject);
router.get("/projects/:id/reports", employerController.getProjectReports);

// Payments
router.get("/payments", employerController.getCompanyPayments);
router.post("/payments/:id/approve", employerController.approvePayment);
router.post("/payments/:id/decline", employerController.declinePayment);

// Automated interviews
router.post("/interviews", employerController.createInterview);
router.get("/interviews", employerController.getAllInterviews);
router.get("/interviews/:id", employerController.getInterviewById);
router.put("/interviews/:id", employerController.updateInterview);
router.delete("/interviews/:id", employerController.deleteInterview);
router.get(
  "/interviews/:id/responses",
  employerController.getInterviewResponses
);

// Jobs
router.post("/jobs", employerController.createJob);
router.get("/jobs", employerController.getAllJobs);
router.get("/jobs/:id", employerController.getJobById);
router.put("/jobs/:id", employerController.updateJob);
router.delete("/jobs/:id", employerController.deleteJob);
router.get("/jobs/:id/applications", employerController.getJobApplications);

// Reports
router.get(
  "/reports/efficiency",
  employerController.getEmployeeEfficiencyReports
);
router.get("/reports/attendance", employerController.getAttendanceReports);

module.exports = router;
