const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const auth = require("../middleware/auth");
const {
  isEmployerOrAdmin,
  isProjectMember,
} = require("../middleware/permissions");
const upload = require("../middleware/upload");

// All routes require authentication
router.use(auth);

// Routes for everyone with proper access
router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);

// Routes requiring employer or admin access
router.post("/", isEmployerOrAdmin, projectController.createProject);
router.put("/:id", isEmployerOrAdmin, projectController.updateProject);
router.delete("/:id", isEmployerOrAdmin, projectController.deleteProject);
router.post(
  "/:id/assign",
  isEmployerOrAdmin,
  projectController.assignEmployeesToProject
);
router.delete(
  "/:id/unassign/:employeeId",
  isEmployerOrAdmin,
  projectController.removeEmployeeFromProject
);

// Routes requiring project membership
router.post("/:id/progress", isProjectMember, projectController.updateProgress);
router.post("/:id/complete", isProjectMember, projectController.markComplete);
router.post(
  "/:id/files",
  isProjectMember,
  upload.array("files", 5),
  projectController.uploadProjectFiles
);
router.get("/:id/files", isProjectMember, projectController.getProjectFiles);

// Comments and discussions
router.post("/:id/comments", isProjectMember, projectController.addComment);
router.get("/:id/comments", isProjectMember, projectController.getComments);

module.exports = router;
