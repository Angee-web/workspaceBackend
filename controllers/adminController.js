const User = require("../models/User");
const Company = require("../models/Company");
const Payment = require("../models/Payment");
const emailService = require("../services/emailService");

/**
 * Get all companies
 */
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find()
      .populate("owner", "fullName email")
      .select("-__v");

    res.status(200).json({ companies });
  } catch (error) {
    console.error("Get all companies error:", error);
    res.status(500).json({ message: "Server error while fetching companies" });
  }
};

/**
 * Get company details
 */
exports.getCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId)
      .populate("owner", "fullName email")
      .populate("employees", "fullName email role")
      .select("-__v");

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.status(200).json({ company });
  } catch (error) {
    console.error("Get company error:", error);
    res.status(500).json({ message: "Server error while fetching company" });
  }
};

/**
 * Approve company
 */
exports.approveCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    company.status = "approved";
    company.approvedAt = Date.now();
    company.approvedBy = req.user._id;
    await company.save();

    // Notify company owner
    await emailService.sendCompanyApprovalEmail(
      company.owner.email,
      company.name
    );

    res.status(200).json({ message: "Company approved successfully", company });
  } catch (error) {
    console.error("Approve company error:", error);
    res.status(500).json({ message: "Server error while approving company" });
  }
};

/**
 * Reject company
 */
exports.rejectCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { reason } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    company.status = "rejected";
    company.rejectionReason = reason;
    company.rejectedAt = Date.now();
    company.rejectedBy = req.user._id;
    await company.save();

    // Notify company owner
    await emailService.sendCompanyRejectionEmail(
      company.owner.email,
      company.name,
      reason
    );

    res.status(200).json({ message: "Company rejected successfully", company });
  } catch (error) {
    console.error("Reject company error:", error);
    res.status(500).json({ message: "Server error while rejecting company" });
  }
};

/**
 * Get all users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select(
        "-password -verificationToken -resetToken -resetTokenExpiry -verificationTokenExpiry"
      )
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
};

/**
 * Get user by ID
 */
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      "-password -verificationToken -resetToken -resetTokenExpiry -verificationTokenExpiry"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error while fetching user" });
  }
};

/**
 * Disable user
 */
exports.disableUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.active = false;
    user.disabledReason = reason;
    user.disabledAt = Date.now();
    user.disabledBy = req.user._id;
    await user.save();

    // Notify user
    await emailService.sendAccountDisabledEmail(user.email, reason);

    res.status(200).json({ message: "User disabled successfully" });
  } catch (error) {
    console.error("Disable user error:", error);
    res.status(500).json({ message: "Server error while disabling user" });
  }
};

/**
 * Enable user
 */
exports.enableUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.active = true;
    user.disabledReason = undefined;
    user.disabledAt = undefined;
    user.disabledBy = undefined;
    await user.save();

    // Notify user
    await emailService.sendAccountEnabledEmail(user.email);

    res.status(200).json({ message: "User enabled successfully" });
  } catch (error) {
    console.error("Enable user error:", error);
    res.status(500).json({ message: "Server error while enabling user" });
  }
};

/**
 * Get payment disputes
 */
exports.getPaymentDisputes = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const disputes = await Payment.find({
      disputed: true,
      disputeResolved: false,
    })
      .populate("employer", "fullName email company")
      .populate("employee", "fullName email")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ disputedAt: -1 });

    const total = await Payment.countDocuments({
      disputed: true,
      disputeResolved: false,
    });

    res.status(200).json({
      disputes,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get payment disputes error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching payment disputes" });
  }
};

/**
 * Resolve payment dispute
 */
exports.resolvePaymentDispute = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { resolution, notes } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (!payment.disputed) {
      return res
        .status(400)
        .json({ message: "This payment is not under dispute" });
    }

    if (payment.disputeResolved) {
      return res
        .status(400)
        .json({ message: "This dispute has already been resolved" });
    }

    // Update payment
    payment.disputeResolved = true;
    payment.disputeResolvedAt = Date.now();
    payment.disputeResolvedBy = req.user._id;
    payment.disputeResolution = resolution;
    payment.disputeNotes = notes;

    if (resolution === "approved") {
      payment.status = "approved";
      payment.approvedAt = Date.now();
      // Process payment via Paystack
      // This would typically call paymentService.processPayment(payment);
    } else if (resolution === "rejected") {
      payment.status = "rejected";
      payment.rejectedAt = Date.now();
    }

    await payment.save();

    // Notify employer and employee
    const employer = await User.findById(payment.employer);
    const employee = await User.findById(payment.employee);

    await emailService.sendDisputeResolutionEmail(
      employer.email,
      employee.email,
      payment,
      resolution,
      notes
    );

    res.status(200).json({
      message: `Payment dispute resolved as ${resolution}`,
      payment,
    });
  } catch (error) {
    console.error("Resolve payment dispute error:", error);
    res
      .status(500)
      .json({ message: "Server error while resolving payment dispute" });
  }
};

/**
 * Get admin dashboard stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const totalCompanies = await Company.countDocuments();
    const pendingCompanies = await Company.countDocuments({
      status: "pending",
    });
    const totalEmployers = await User.countDocuments({ role: "employer" });
    const totalEmployees = await User.countDocuments({ role: "employee" });
    const activeDisputes = await Payment.countDocuments({
      disputed: true,
      disputeResolved: false,
    });

    // Recent registrations
    const recentUsers = await User.find()
      .select("fullName email role createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent companies
    const recentCompanies = await Company.find()
      .select("name status createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      stats: {
        totalCompanies,
        pendingCompanies,
        totalEmployers,
        totalEmployees,
        activeDisputes,
      },
      recentUsers,
      recentCompanies,
    });
  } catch (error) {r
    console.error("Get dashboard stats error:", eror);
    res
      .status(500)
      .json({ message: "Server error while fetching dashboard stats" });
  }
};
