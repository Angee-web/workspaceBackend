const Project = require("../models/Project");
const User = require("../models/User");
const {
  validateProject,
  validateProjectUpdate,
} = require("../utils/validators");

/**
 * Get all projects for a company
 */
exports.getCompanyProjects = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const projects = await Project.find({ company: user.company })
      .populate("assignees", "firstName lastName email")
      .populate("createdBy", "firstName lastName");

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.error("Error getting projects:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get a single project
 */
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("assignees", "firstName lastName email profilePicture")
      .populate("createdBy", "firstName lastName")
      .populate({
        path: "progressUpdates.employee",
        select: "firstName lastName",
      });

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check if user has access to this project
    const user = await User.findById(req.user.id);

    if (
      project.company.toString() !== user.company.toString() &&
      !project.assignees.some((a) => a._id.toString() === req.user.id) &&
      project.createdBy._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this project",
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error getting project:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Create a project
 */
exports.createProject = async (req, res) => {
  try {
    const { error } = validateProject(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    const { name, description, startDate, endDate, assignees, milestones } =
      req.body;

    const user = await User.findById(req.user.id);

    // Verify assignees belong to the same company
    if (assignees && assignees.length > 0) {
      const employees = await User.find({
        _id: { $in: assignees },
        company: user.company,
      });

      if (employees.length !== assignees.length) {
        return res.status(400).json({
          success: false,
          message: "One or more assignees do not belong to your company",
        });
      }
    }

    const project = new Project({
      name,
      description,
      startDate,
      endDate,
      company: user.company,
      createdBy: req.user.id,
      assignees: assignees || [],
      milestones: milestones || [],
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Update a project
 */
exports.updateProject = async (req, res) => {
  try {
    const { error } = validateProjectUpdate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    const {
      name,
      description,
      startDate,
      endDate,
      status,
      assignees,
      milestones,
    } = req.body;

    // Find project
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check if user is authorized to update
    const user = await User.findById(req.user.id);

    if (
      project.company.toString() !== user.company.toString() &&
      project.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this project",
      });
    }

    // Verify assignees belong to the same company
    if (assignees && assignees.length > 0) {
      const employees = await User.find({
        _id: { $in: assignees },
        company: user.company,
      });

      if (employees.length !== assignees.length) {
        return res.status(400).json({
          success: false,
          message: "One or more assignees do not belong to your company",
        });
      }
    }

    // Update project
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (status) updateData.status = status;
    if (assignees) updateData.assignees = assignees;
    if (milestones) updateData.milestones = milestones;

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("assignees", "firstName lastName email")
      .populate("createdBy", "firstName lastName");

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updatedProject,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Delete a project
 */
exports.deleteProject = async (req, res) => {
  try {
    // Find project
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check if user is authorized to delete
    const user = await User.findById(req.user.id);

    if (
      project.company.toString() !== user.company.toString() &&
      project.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this project",
      });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Add a milestone to a project
 */
exports.addMilestone = async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;

    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "Milestone title is required" });
    }

    // Find project
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check if user is authorized
    const user = await User.findById(req.user.id);

    if (
      project.company.toString() !== user.company.toString() &&
      project.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this project",
      });
    }

    // Add milestone
    project.milestones.push({
      title,
      description,
      dueDate,
      status: "pending",
    });

    await project.save();

    res.status(200).json({
      success: true,
      message: "Milestone added successfully",
      data: project.milestones[project.milestones.length - 1],
    });
  } catch (error) {
    console.error("Error adding milestone:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Update a milestone
 */
exports.updateMilestone = async (req, res) => {
  try {
    const { title, description, dueDate, status } = req.body;

    // Find project
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check if user is authorized
    const user = await User.findById(req.user.id);

    if (
      project.company.toString() !== user.company.toString() &&
      project.createdBy.toString() !== req.user.id &&
      !project.assignees.includes(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this project",
      });
    }

    // Find milestone
    const milestone = project.milestones.id(req.params.milestoneId);

    if (!milestone) {
      return res
        .status(404)
        .json({ success: false, message: "Milestone not found" });
    }

    // Update milestone
    if (title) milestone.title = title;
    if (description) milestone.description = description;
    if (dueDate) milestone.dueDate = dueDate;
    if (status) milestone.status = status;

    milestone.updatedAt = Date.now();

    await project.save();

    res.status(200).json({
      success: true,
      message: "Milestone updated successfully",
      data: milestone,
    });
  } catch (error) {
    console.error("Error updating milestone:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get employee projects
 */
exports.getEmployeeProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      assignees: req.user.id,
    })
      .populate("assignees", "firstName lastName email")
      .populate("createdBy", "firstName lastName");

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.error("Error getting employee projects:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
