const Company = require("../models/Company");

/**
 * Middleware to check user roles
 * @param {Array} roles - Array of allowed roles
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied: insufficient permissions" });
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

/**
 * Employer-only middleware
 */
const isEmployer = (req, res, next) => {
  if (!req.user || req.user.role !== "employer") {
    return res.status(403).json({ message: "Employer access required" });
  }
  next();
};

/**
 * Employee-only middleware
 */
const isEmployee = (req, res, next) => {
  if (!req.user || req.user.role !== "employee") {
    return res.status(403).json({ message: "Employee access required" });
  }
  next();
};

/**
 * Middleware to check if employer has access to specific employee
 */
const canAccessEmployee = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "admin") {
      // Admins can access all employees
      return next();
    }

    if (req.user.role !== "employer") {
      return res.status(403).json({ message: "Access denied" });
    }

    const employeeId = req.params.employeeId || req.body.employeeId;
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID required" });
    }

    // Check if employee belongs to employer's company
    const company = await Company.findOne({
      owner: req.user._id,
      employees: { $elemMatch: { $eq: employeeId } },
    });

    if (!company) {
      return res
        .status(403)
        .json({ message: "Access denied: employee not found in your company" });
    }

    next();
  } catch (error) {
    console.error("Permission middleware error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Middleware to check if user can access project
 */
const canAccessProject = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "admin") {
      // Admins can access all projects
      return next();
    }

    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) {
      return res.status(400).json({ message: "Project ID required" });
    }

    // Get the project with populated company field
    const Project = require("../models/Project");
    const project = await Project.findById(projectId).populate("company");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (
      req.user.role === "employer" &&
      project.company.owner.toString() === req.user._id.toString()
    ) {
      // Employer owns the company that owns the project
      return next();
    }

    if (
      req.user.role === "employee" &&
      project.assignedEmployees.includes(req.user._id)
    ) {
      // Employee is assigned to the project
      return next();
    }

    return res
      .status(403)
      .json({
        message:
          "Access denied: you do not have permission to access this project",
      });
  } catch (error) {
    console.error("Project access middleware error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Middleware to validate ownership of a payment
 */
const canAccessPayment = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "admin") {
      // Admins can access all payments
      return next();
    }

    const paymentId = req.params.paymentId || req.body.paymentId;
    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID required" });
    }

    const Payment = require("../models/Payment");
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (
      req.user.role === "employer" &&
      payment.employer.toString() === req.user._id.toString()
    ) {
      // Employer is the one who made the payment
      return next();
    }

    if (
      req.user.role === "employee" &&
      payment.employee.toString() === req.user._id.toString()
    ) {
      // Employee is the recipient of the payment
      return next();
    }

    return res
      .status(403)
      .json({
        message:
          "Access denied: you do not have permission to access this payment",
      });
  } catch (error) {
    console.error("Payment access middleware error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  checkRole,
  isAdmin,
  isEmployer,
  isEmployee,
  canAccessEmployee,
  canAccessProject,
  canAccessPayment,
};
