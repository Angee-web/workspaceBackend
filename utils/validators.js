/**
 * Data validation utilities for the HR Management System
 */

const Joi = require("joi");

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether the email is valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Nigerian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
const isValidPhone = (phone) => {
  // Nigerian phone number format (starting with +234 or 0)
  const phoneRegex = /^(\+234|0)[0-9]{10}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate Nigerian NIN (National Identification Number)
 * @param {string} nin - NIN to validate
 * @returns {boolean} - Whether the NIN is valid
 */
const isValidNIN = (nin) => {
  // NIN is 11 digits
  const ninRegex = /^[0-9]{11}$/;
  return ninRegex.test(nin);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with isValid flag and message
 */
const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return {
      isValid: false,
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    };
  }

  return { isValid: true, message: "Password is strong" };
};

/**
 * Validation schema for user registration
 */
const userRegistrationSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
  }),
  role: Joi.string().valid("admin", "employer", "employee").required(),
  phone: Joi.string().optional(),
});

/**
 * Validation schema for company registration
 */
const companyRegistrationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  industry: Joi.string().required(),
  address: Joi.string().required(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().required(),
  logo: Joi.string().optional(),
  employerIds: Joi.array().items(Joi.string()).optional(),
});

/**
 * Validation schema for employer profile update
 */
const employerProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  position: Joi.string().optional(),
  department: Joi.string().optional(),
  companyId: Joi.string().required(),
});

/**
 * Validation schema for employee invitation
 */
const employeeInvitationSchema = Joi.object({
  email: Joi.string().email().required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().required(),
  workPeriod: Joi.object({
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
    workingDays: Joi.array().items(Joi.number().min(0).max(6)).required(),
  }).required(),
  supervisor: Joi.string().required(),
  leaves: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().required(),
        daysAllowed: Joi.number().required(),
      })
    )
    .optional(),
  benefits: Joi.array().items(Joi.string()).optional(),
  salary: Joi.number().required(),
  position: Joi.string().required(),
  department: Joi.string().optional(),
  companyId: Joi.string().required(),
});

/**
 * Validation schema for project creation
 */
const projectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref("startDate")).required(),
  assignedEmployees: Joi.array().items(Joi.string()).optional(),
  tasks: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        dueDate: Joi.date().required(),
        assignedTo: Joi.string().optional(),
      })
    )
    .optional(),
  status: Joi.string()
    .valid("planning", "inProgress", "completed", "onHold")
    .default("planning"),
  companyId: Joi.string().required(),
});

/**
 * Validation schema for employee document uploads
 */
const documentSchema = Joi.object({
  type: Joi.string()
    .valid("nin", "utilityBill", "passport", "driverLicense", "other")
    .required(),
  documentNumber: Joi.string().when("type", {
    is: "nin",
    then: Joi.string()
      .pattern(/^[0-9]{11}$/)
      .required(),
    otherwise: Joi.string().optional(),
  }),
  expiryDate: Joi.date().greater("now").optional(),
  documentUrl: Joi.string().required(),
  description: Joi.string().optional(),
});

/**
 * Validation schema for payment settings
 */
const paymentSettingsSchema = Joi.object({
  accountName: Joi.string().required(),
  accountNumber: Joi.string().required(),
  bankCode: Joi.string().required(),
  bankName: Joi.string().required(),
});

/**
 * Validation schema for automated interview setup
 */
const interviewSchema = Joi.object({
  jobTitle: Joi.string().required(),
  description: Joi.string().required(),
  questions: Joi.array()
    .items(
      Joi.object({
        question: Joi.string().required(),
        timeLimit: Joi.number().default(60).optional(), // time in seconds
        type: Joi.string().valid("video", "text").default("video").optional(),
      })
    )
    .min(1)
    .required(),
  expiryDate: Joi.date().greater("now").required(),
  companyId: Joi.string().required(),
});

/**
 * Validation schema for break period
 */
const breakPeriodSchema = Joi.object({
  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required(),
  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required(),
  title: Joi.string().default("Break").optional(),
});

/**
 * Validation schema for daily progress report
 */
const progressReportSchema = Joi.object({
  employeeId: Joi.string().required(),
  date: Joi.date().default(Date.now).optional(),
  tasks: Joi.array()
    .items(
      Joi.object({
        description: Joi.string().required(),
        status: Joi.string()
          .valid("completed", "inProgress", "blocked")
          .required(),
        timeSpent: Joi.number().optional(), // in minutes
        notes: Joi.string().optional(),
      })
    )
    .min(1)
    .required(),
  summary: Joi.string().required(),
  blockers: Joi.string().optional(),
  projectId: Joi.string().optional(),
});

/**
 * Custom validation middleware function generator
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Request source to validate ('body', 'query', 'params')
 * @returns {Function} - Express middleware function
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error } = schema.validate(req[source], { abortEarly: false });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({ success: false, errors: errorMessages });
    }

    next();
  };
};

/**
 * Validate an object against a schema (for internal use)
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} - Validation result with isValid flag and errors
 */
const validateData = (data, schema) => {
  const { error } = schema.validate(data, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    return { isValid: false, errors: errorMessages };
  }

  return { isValid: true, errors: [] };
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Whether the ID is a valid ObjectId
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return objectIdPattern.test(id);
};

/**
 * Validate time format (HH:MM)
 * @param {string} time - Time string to validate
 * @returns {boolean} - Whether the time format is valid
 */
const isValidTimeFormat = (time) => {
  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timePattern.test(time);
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidNIN,
  validatePasswordStrength,
  userRegistrationSchema,
  companyRegistrationSchema,
  employerProfileSchema,
  employeeInvitationSchema,
  projectSchema,
  documentSchema,
  paymentSettingsSchema,
  interviewSchema,
  breakPeriodSchema,
  progressReportSchema,
  validate,
  validateData,
  isValidObjectId,
  isValidTimeFormat,
};
