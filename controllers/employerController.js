const User = require("../models/User");
const Company = require("../models/Company");
const Project = require("../models/Project");
const Payment = require("../models/Payment");
const { generatePdf } = require("../services/pdfService");
const { sendEmployeeInvite } = require("../services/emailService");
const {
  validateEmployeeInvite,
  validateProject,
} = require("../utils/validators");
const { cloudinaryUpload } = require("../config/cloudinary");

/**
 * Invite an employee
 */
exports.inviteEmployee = async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      role,
      workPeriod,
      supervisor,
      leaves,
      benefits,
      wages,
      balance,
      workingDays,
      breakPeriod,
      designation,
    } = req.body;

    const { error } = validateEmployeeInvite(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered" });
    }

    // Get employer's company
    const employer = await User.findById(req.user.id).populate("company");
    if (!employer.company) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Employer not associated with a company",
        });
    }

    // Create employment contract PDF
    const contractData = {
      employeeName: `${firstName} ${lastName}`,
      employeeEmail: email,
      employerName: employer.firstName + " " + employer.lastName,
      companyName: employer.company.name,
      role: designation,
      workPeriod,
      supervisor,
      wages,
      benefits,
      leaves,
      workingDays,
      startDate: new Date().toISOString(),
    };

    const pdfBuffer = await generatePdf("employmentContract", contractData);
    const pdfResult = await cloudinaryUpload(
      pdfBuffer,
      "contracts",
      `contract_${email}`
    );

    // Create temporary employee record
    const employee = new User({
      email,
      firstName,
      lastName,
      role: "employee",
      isInvited: true,
      company: employer.company._id,
      employmentDetails: {
        workPeriod,
        supervisor,
        leaves,
        benefits,
        wages,
        balance: balance || 0,
        workingDays,
        breakPeriod,
        designation,
        contractUrl: pdfResult.secure_url,
        dailyRate: wages / (workingDays.length * 4), // Approximate daily rate
      },
    });

    await employee.save();

    // Send invitation email
    await sendEmployeeInvite(email, {
      employerName: `${employer.firstName} ${employer.lastName}`,
      companyName: employer.company.name,
      role: designation,
      contractUrl: pdfResult.secure_url,
    });

    res.status(201).json({
      success: true,
      message: "Employee invited successfully",
      data: {
        employeeId: employee._id,
        email,
        contractUrl: pdfResult.secure_url,
      },
    });
  } catch (error) {
    console.error("Error inviting employee:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Terminate employee
 */
exports.terminateEmployee = async (req, res) => {
  try {
    const { employeeId, reason } = req.body;

    if (!employeeId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and termination reason are required",
      });
    }

    // Check if employee exists and belongs to employer's company
    const employer = await User.findById(req.user.id);
    const employee = await User.findById(employeeId);

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    if (employee.role !== "employee") {
      return res
        .status(400)
        .json({ success: false, message: "User is not an employee" });
    }

    if (employee.company.toString() !== employer.company.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to terminate this employee",
      });
    }

    // Update employee status
    employee.isActive = false;
    employee.terminationDetails = {
      date: Date.now(),
      reason,
      terminatedBy: req.user.id,
    };

    await employee.save();

    res.status(200).json({
      success: true,
      message: "Employee terminated successfully",
    });
  } catch (error) {
    console.error("Error terminating employee:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Create project
 */
exports.createProject = async (req, res) => {
  try {
    const { name, description, startDate, endDate, assignees, milestones } =
      req.body;

    const { error } = validateProject(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    // Verify assignees belong to employer's company
    const employer = await User.findById(req.user.id);

    if (assignees && assignees.length > 0) {
      const employees = await User.find({
        _id: { $in: assignees },
        company: employer.company,
      });

      if (employees.length !== assignees.length) {
        return res.status(400).json({
          success: false,
          message:
            "One or more assignees are not valid employees of your company",
        });
      }
    }

    const project = new Project({
      name,
      description,
      startDate,
      endDate,
      company: employer.company,
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
 * Set monthly salary
 */
exports.setMonthlySalary = async (req, res) => {
  try {
    const { employeeId, salary } = req.body;

    if (!employeeId || !salary || isNaN(salary) || salary <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID and salary amount are required",
      });
    }

    // Check if employee exists and belongs to employer's company
    const employer = await User.findById(req.user.id);
    const employee = await User.findById(employeeId);

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    if (employee.company.toString() !== employer.company.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this employee",
      });
    }

    // Update employee's salary
    employee.employmentDetails.wages = parseFloat(salary);

    // Recalculate daily rate based on working days
    const workingDaysPerMonth =
      employee.employmentDetails.workingDays?.length * 4 || 20; // Default to 20 if not set
    employee.employmentDetails.dailyRate =
      parseFloat(salary) / workingDaysPerMonth;

    await employee.save();

    res.status(200).json({
      success: true,
      message: "Monthly salary updated successfully",
      data: {
        employeeId,
        salary: employee.employmentDetails.wages,
        dailyRate: employee.employmentDetails.dailyRate,
      },
    });
  } catch (error) {
    console.error("Error setting monthly salary:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Set working days
 */
exports.setWorkingDays = async (req, res) => {
  try {
    const { employeeId, workingDays } = req.body;

    if (!employeeId || !workingDays || !Array.isArray(workingDays)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID and working days array are required",
      });
    }

    // Validate working days (mon, tue, wed, thu, fri, sat, sun)
    const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const isValid = workingDays.every((day) =>
      validDays.includes(day.toLowerCase())
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message:
          "Working days must be valid day codes (mon, tue, wed, thu, fri, sat, sun)",
      });
    }

    // Check if employee exists and belongs to employer's company
    const employer = await User.findById(req.user.id);
    const employee = await User.findById(employeeId);

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    if (employee.company.toString() !== employer.company.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this employee",
      });
    }

    // Update employee's working days
    employee.employmentDetails.workingDays = workingDays.map((day) =>
      day.toLowerCase()
    );

    // Recalculate daily rate based on new working days
    if (employee.employmentDetails.wages) {
      const workingDaysPerMonth = workingDays.length * 4; // Approximate 4 weeks per month
      employee.employmentDetails.dailyRate =
        employee.employmentDetails.wages / workingDaysPerMonth;
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: "Working days updated successfully",
      data: {
        employeeId,
        workingDays: employee.employmentDetails.workingDays,
        dailyRate: employee.employmentDetails.dailyRate,
      },
    });
  } catch (error) {
    console.error("Error setting working days:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Set break period
 */
exports.setBreakPeriod = async (req, res) => {
  try {
    const { employeeId, startTime, endTime } = req.body;

    if (!employeeId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, break start time, and end time are required",
      });
    }

    // Validate time format (24-hour format: HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Times must be in 24-hour format (HH:MM)",
      });
    }

    // Check if employee exists and belongs to employer's company
    const employer = await User.findById(req.user.id);
    const employee = await User.findById(employeeId);

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    if (employee.company.toString() !== employer.company.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this employee",
      });
    }

    // Update employee's break period
    employee.employmentDetails.breakPeriod = {
      startTime,
      endTime,
    };

    await employee.save();

    res.status(200).json({
      success: true,
      message: "Break period updated successfully",
      data: {
        employeeId,
        breakPeriod: employee.employmentDetails.breakPeriod,
      },
    });
  } catch (error) {
    console.error("Error setting break period:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Add balance
 */
exports.addBalance = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    // Update employer's company balance
    const employer = await User.findById(req.user.id).populate("company");

    if (!employer.company) {
      return res.status(400).json({
        success: false,
        message: "Employer not associated with a company",
      });
    }

    const company = await Company.findById(employer.company._id);
    company.balance += parseFloat(amount);
    await company.save();

    res.status(200).json({
      success: true,
      message: "Balance added successfully",
      data: {
        newBalance: company.balance,
      },
    });
  } catch (error) {
    console.error("Error adding balance:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Process daily payment (approve/decline)
 */
exports.processDailyPayment = async (req, res) => {
  try {
    const { paymentId, action, reason } = req.body;

    if (!paymentId || !action || !["approve", "decline"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Payment ID and valid action (approve/decline) are required",
      });
    }

    if (action === "decline" && !reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required when declining a payment",
      });
    }

    // Check if payment exists and belongs to employer's company
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    const employer = await User.findById(req.user.id);

    // Check if payment is for an employee of the employer's company
    const employee = await User.findById(payment.employee);

    if (employee.company.toString() !== employer.company.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to process this payment",
      });
    }

    // Check if we're within the approval window (1 hour after COB)
    const now = new Date();
    const paymentTime = new Date(payment.createdAt);
    const hoursSinceCreation = (now - paymentTime) / (1000 * 60 * 60);

    if (hoursSinceCreation > 1) {
      return res.status(400).json({
        success: false,
        message: "Approval window has expired (1 hour after payment creation)",
      });
    }

    if (action === "approve") {
      payment.status = "approved";
      payment.approvedBy = req.user.id;
      payment.approvedAt = Date.now();
    } else {
      payment.status = "declined";
      payment.declinedBy = req.user.id;
      payment.declinedAt = Date.now();
      payment.declineReason = reason;

      // Send for admin review
      payment.requiresAdminReview = true;
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: `Payment ${
        action === "approve" ? "approved" : "declined"
      } successfully`,
      data: payment,
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Set up automated interview
 */
exports.setupAutomatedInterview = async (req, res) => {
  try {
    const { title, description, questions, jobPosition } = req.body;

    if (
      !title ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Title and at least one question are required",
      });
    }

    // Create interview
    const employer = await User.findById(req.user.id);

    const interview = new Interview({
      title,
      description,
      jobPosition,
      company: employer.company,
      createdBy: req.user.id,
      questions: questions.map((q) => ({
        text: q.text,
        maxDuration: q.maxDuration || 60, // Default 60 seconds
        type: q.type || "video",
      })),
    });

    await interview.save();

    res.status(201).json({
      success: true,
      message: "Automated interview created successfully",
      data: interview,
    });
  } catch (error) {
    console.error("Error setting up interview:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
