/**
 * Scheduled tasks for the HR Management System
 * Handles automated jobs like daily payments, monitoring, and notifications
 */

const cron = require("node-cron");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const isSameOrBefore = require("dayjs/plugin/isSameOrBefore");
const isBetween = require("dayjs/plugin/isBetween");
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

// Models
const User = require("../models/User");
const Company = require("../models/Company");
const Payment = require("../models/Payment");
const Attendance = require("../models/Attendance");
const Project = require("../models/Project");

// Services
const emailService = require("../services/emailService");
const faceService = require("../services/faceService");
const paymentService = require("../services/paymentService");

// Utils
const {
  isWorkingDay,
  generateRandomMonitoringTimes,
  calculateEfficiency,
  isWorkingHour,
  calculateDailyPayRate,
} = require("../utils/helpers");

// Keep track of monitoring jobs for each employee
const monitoringJobs = new Map();

/**
 * Initialize all scheduled tasks
 */
function initScheduledTasks() {
  // Run at midnight to schedule employee monitoring for the day
  cron.schedule("0 0 * * *", scheduleEmployeeMonitoring);

  // Run at end of business day to process daily payments
  cron.schedule("0 18 * * *", processDailyPayments);

  // Run at end of business day to send efficiency reports
  cron.schedule("0 18 * * *", sendEfficiencyReports);

  // Run at midnight to handle payment approvals that weren't acted upon
  cron.schedule("0 0 * * *", handlePendingPayments);

  // Run weekly to clean up old data
  cron.schedule("0 0 * * 0", cleanupOldData);

  // Run at midnight to check for expiring documents
  cron.schedule("0 0 * * *", checkExpiringDocuments);

  // Run hourly to update project status based on due dates
  cron.schedule("0 * * * *", updateProjectStatuses);

  console.log("🔄 Scheduled tasks initialized");
}

/**
 * Schedule employee monitoring for the day
 * Generates random times throughout the workday to take snapshots
 */
async function scheduleEmployeeMonitoring() {
  try {
    console.log("📅 Scheduling employee monitoring for today");

    // Clear previous monitoring jobs
    for (const [employeeId, jobsList] of monitoringJobs.entries()) {
      jobsList.forEach((job) => job.stop());
    }
    monitoringJobs.clear();

    // Get all active employees
    const employees = await User.find({
      role: "employee",
      isActive: true,
      "workSchedule.workingDays": { $exists: true },
    }).populate("workSchedule");

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    for (const employee of employees) {
      // Skip if today is not a working day for this employee
      if (
        !employee.workSchedule ||
        !employee.workSchedule.workingDays.includes(dayOfWeek)
      ) {
        continue;
      }

      // Generate random monitoring times for this employee
      const workStartTime = employee.workSchedule.startTime;
      const workEndTime = employee.workSchedule.endTime;
      const breakPeriods = employee.workSchedule.breaks || [];

      const monitoringTimes = generateRandomMonitoringTimes(
        workStartTime,
        workEndTime,
        breakPeriods,
        10 // Number of monitoring attempts
      );

      const employeeJobs = [];

      // Schedule monitoring for each time
      for (const monitoringTime of monitoringTimes) {
        const [hour, minute] = monitoringTime.split(":");

        const job = cron.schedule(`${minute} ${hour} * * *`, async () => {
          await monitorEmployee(employee._id);
        });

        employeeJobs.push(job);
      }

      monitoringJobs.set(employee._id.toString(), employeeJobs);

      // Log the scheduled times for debugging
      console.log(
        `Scheduled monitoring for employee ${
          employee._id
        } at: ${monitoringTimes.join(", ")}`
      );
    }
  } catch (error) {
    console.error("Error scheduling employee monitoring:", error);
  }
}

/**
 * Monitor an employee at a specific time
 * Takes a snapshot and records attendance
 * @param {string} employeeId - ID of the employee to monitor
 */
async function monitorEmployee(employeeId) {
  try {
    console.log(`📸 Monitoring employee: ${employeeId}`);

    const employee = await User.findById(employeeId)
      .populate("workSchedule")
      .populate("company");

    if (!employee || !employee.isActive) {
      console.log(`Employee ${employeeId} is no longer active`);
      return;
    }

    // Check if employee is clocked in
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (!attendance || !attendance.clockInTime) {
      console.log(`Employee ${employeeId} is not clocked in`);

      // Create attendance record with absent status
      if (!attendance) {
        await Attendance.create({
          employee: employeeId,
          company: employee.company._id,
          date: today,
          isPresent: false,
          monitoringResults: [
            {
              time: new Date(),
              isPresent: false,
              imageUrl: null,
            },
          ],
        });
      } else {
        // Update existing attendance record
        attendance.monitoringResults.push({
          time: new Date(),
          isPresent: false,
          imageUrl: null,
        });
        await attendance.save();
      }

      return;
    }

    // Check if currently in a break period
    const currentTime = dayjs().format("HH:mm");
    const isInBreak = !isWorkingHour(
      currentTime,
      employee.workSchedule.startTime,
      employee.workSchedule.endTime,
      employee.workSchedule.breaks || []
    );

    if (isInBreak) {
      console.log(`Skipping monitoring for ${employeeId} - currently on break`);
      return;
    }

    // Take a snapshot and run face recognition
    const imageResult = await faceService.captureEmployeeSnapshot(employeeId);

    if (!imageResult.success) {
      console.log(`Failed to capture snapshot for employee ${employeeId}`);

      // Update attendance record
      attendance.monitoringResults.push({
        time: new Date(),
        isPresent: false,
        imageUrl: null,
        notes: "Failed to capture snapshot",
      });
      await attendance.save();

      return;
    }

    // Verify employee's face
    const verificationResult = await faceService.verifyEmployeeFace(
      employeeId,
      imageResult.imageUrl
    );

    // Update attendance record
    attendance.monitoringResults.push({
      time: new Date(),
      isPresent: verificationResult.isMatch,
      imageUrl: imageResult.imageUrl,
      confidence: verificationResult.confidence,
    });

    await attendance.save();

    console.log(
      `Monitoring complete for employee ${employeeId} - Present: ${verificationResult.isMatch}`
    );
  } catch (error) {
    console.error(`Error monitoring employee ${employeeId}:`, error);
  }
}

/**
 * Process daily payments for all employees
 * Runs at the end of business day
 */
async function processDailyPayments() {
  try {
    console.log("💰 Processing daily payments");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();

    // Get all active employees
    const employees = await User.find({
      role: "employee",
      isActive: true,
      "paymentInfo.salary": { $exists: true },
    })
      .populate("workSchedule")
      .populate("company");

    for (const employee of employees) {
      // Skip if today is not a working day for this employee
      if (
        !employee.workSchedule ||
        !employee.workSchedule.workingDays.includes(dayOfWeek)
      ) {
        continue;
      }

      // Get attendance record for today
      const attendance = await Attendance.findOne({
        employee: employee._id,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      // Skip if employee did not clock in or clock out
      if (!attendance || !attendance.clockInTime || !attendance.clockOutTime) {
        console.log(
          `Skipping payment for employee ${employee._id} - incomplete attendance`
        );
        continue;
      }

      // Calculate daily pay rate
      const monthlySalary = employee.paymentInfo.salary;
      const workingDaysPerMonth = employee.workSchedule.workingDays.length * 4; // Approximation
      const dailyRate = calculateDailyPayRate(
        monthlySalary,
        workingDaysPerMonth
      );

      // Calculate efficiency
      const monitoringResults = attendance.monitoringResults || [];
      const presentCount = monitoringResults.filter((r) => r.isPresent).length;
      const efficiency = calculateEfficiency(
        presentCount,
        monitoringResults.length
      );

      // Determine if payment should be automatically approved
      const autoApprove = efficiency >= 70; // Automatically approve if efficiency is 70% or higher

      // Create payment record
      const payment = new Payment({
        employee: employee._id,
        employer: employee.company.employer,
        company: employee.company._id,
        amount: dailyRate,
        date: today,
        type: "daily",
        status: autoApprove ? "pending_approval" : "needs_review",
        efficiency: efficiency,
        attendanceRecord: attendance._id,
        paymentDetails: {
          workingHours: (
            (attendance.clockOutTime - attendance.clockInTime) /
            (1000 * 60 * 60)
          ).toFixed(2),
        },
      });

      await payment.save();

      // Notify employer
      const employerUser = await User.findById(employee.company.employer);

      if (employerUser) {
        await emailService.sendDailyPaymentApprovalEmail(employerUser.email, {
          employeeName: `${employee.firstName} ${employee.lastName}`,
          date: dayjs(today).format("MMMM D, YYYY"),
          amount: dailyRate.toFixed(2),
          efficiency: `${efficiency}%`,
          paymentId: payment._id,
        });
      }

      console.log(
        `Payment processed for employee ${employee._id} - Efficiency: ${efficiency}%`
      );
    }
  } catch (error) {
    console.error("Error processing daily payments:", error);
  }
}

/**
 * Send efficiency reports to employers at the end of business day
 */
async function sendEfficiencyReports() {
  try {
    console.log("📊 Sending efficiency reports");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all companies
    const companies = await Company.find({}).populate("employer");

    for (const company of companies) {
      // Get all employees for this company
      const employees = await User.find({
        company: company._id,
        role: "employee",
        isActive: true,
      });

      if (employees.length === 0) continue;

      const employeeIds = employees.map((emp) => emp._id);

      // Get attendance records for today
      const attendanceRecords = await Attendance.find({
        employee: { $in: employeeIds },
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      }).populate("employee");

      // Get progress reports for today
      const progressReports = await mongoose
        .model("ProgressReport")
        .find({
          employee: { $in: employeeIds },
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        })
        .populate("employee");

      // Create efficiency report data
      const reportData = [];

      for (const employee of employees) {
        const attendance = attendanceRecords.find(
          (a) => a.employee._id.toString() === employee._id.toString()
        );

        const progressReport = progressReports.find(
          (p) => p.employee._id.toString() === employee._id.toString()
        );

        let efficiency = 0;
        let workingHours = 0;
        let clockInStatus = "Absent";

        if (attendance) {
          const monitoringResults = attendance.monitoringResults || [];
          const presentCount = monitoringResults.filter(
            (r) => r.isPresent
          ).length;
          efficiency = calculateEfficiency(
            presentCount,
            monitoringResults.length
          );

          if (attendance.clockInTime) {
            clockInStatus = "Present";

            if (attendance.clockOutTime) {
              workingHours = (
                (attendance.clockOutTime - attendance.clockInTime) /
                (1000 * 60 * 60)
              ).toFixed(2);
            } else {
              clockInStatus = "Working (No Clock Out)";
            }
          }
        }

        reportData.push({
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          efficiency: efficiency,
          status: clockInStatus,
          workingHours: workingHours,
          tasksCompleted: progressReport
            ? progressReport.tasks.filter((t) => t.status === "completed")
                .length
            : 0,
          tasksInProgress: progressReport
            ? progressReport.tasks.filter((t) => t.status === "inProgress")
                .length
            : 0,
          tasksBlocked: progressReport
            ? progressReport.tasks.filter((t) => t.status === "blocked").length
            : 0,
          summary: progressReport
            ? progressReport.summary
            : "No progress report submitted",
        });
      }

      // Send report to employer
      if (company.employer && company.employer.email) {
        await emailService.sendDailyEfficiencyReport(company.employer.email, {
          companyName: company.name,
          date: dayjs(today).format("MMMM D, YYYY"),
          employees: reportData,
        });

        console.log(`Efficiency report sent for company ${company.name}`);
      }
    }
  } catch (error) {
    console.error("Error sending efficiency reports:", error);
  }
}

/**
 * Handle pending payments that weren't approved or rejected
 * Processes payments automatically after deadline
 */
async function handlePendingPayments() {
  try {
    console.log("🔄 Handling pending payments");

    // Get pending payments older than the approval window (1 hour)
    const approvalDeadline = new Date();
    approvalDeadline.setHours(approvalDeadline.getHours() - 1);

    // Find payments that need admin review
    const pendingPayments = await Payment.find({
      status: "pending_approval",
      createdAt: { $lt: approvalDeadline },
    })
      .populate("employee")
      .populate("employer")
      .populate("company");

    for (const payment of pendingPayments) {
      console.log(
        `Processing pending payment ${payment._id} for employee ${payment.employee._id}`
      );

      // Process payment through Paystack
      const paymentResult = await paymentService.processDailyPayment(payment);

      if (paymentResult.success) {
        payment.status = "paid";
        payment.transactionReference = paymentResult.reference;
        payment.paymentDate = new Date();
        await payment.save();

        // Notify employee of payment
        await emailService.sendPaymentNotification(payment.employee.email, {
          employeeName: `${payment.employee.firstName} ${payment.employee.lastName}`,
          amount: payment.amount.toFixed(2),
          date: dayjs(payment.date).format("MMMM D, YYYY"),
          reference: paymentResult.reference,
        });

        console.log(`Payment ${payment._id} successfully processed`);
      } else {
        payment.status = "failed";
        payment.notes = `Automatic payment failed: ${paymentResult.error}`;
        await payment.save();

        // Notify admin of failed payment
        const admins = await User.find({ role: "admin" });
        for (const admin of admins) {
          await emailService.sendPaymentFailureNotification(admin.email, {
            employeeName: `${payment.employee.firstName} ${payment.employee.lastName}`,
            employerName: `${payment.employer.firstName} ${payment.employer.lastName}`,
            companyName: payment.company.name,
            amount: payment.amount.toFixed(2),
            date: dayjs(payment.date).format("MMMM D, YYYY"),
            error: paymentResult.error,
            paymentId: payment._id,
          });
        }

        console.log(`Payment ${payment._id} failed: ${paymentResult.error}`);
      }
    }

    // Handle payments that need admin review
    const reviewPayments = await Payment.find({
      status: "needs_review",
      createdAt: { $lt: approvalDeadline },
    });

    // Notify admins of payments needing review
    if (reviewPayments.length > 0) {
      const admins = await User.find({ role: "admin" });

      for (const admin of admins) {
        await emailService.sendPaymentsNeedingReviewNotification(admin.email, {
          paymentCount: reviewPayments.length,
          date: dayjs().format("MMMM D, YYYY"),
        });
      }
    }
  } catch (error) {
    console.error("Error handling pending payments:", error);
  }
}

/**
 * Clean up old data that's no longer needed
 * Runs weekly
 */
async function cleanupOldData() {
  try {
    console.log("🧹 Cleaning up old data");

    const threeMonthsAgo = dayjs().subtract(3, "month").toDate();

    // Remove old monitoring results but keep attendance records
    const oldAttendance = await Attendance.find({
      date: { $lt: threeMonthsAgo },
    });

    for (const attendance of oldAttendance) {
      // Keep summary data but remove individual monitoring results
      attendance.monitoringResults = [];
      await attendance.save();
    }

    console.log(
      `Cleaned up monitoring results for ${oldAttendance.length} attendance records`
    );

    // Remove expired invitation tokens
    await mongoose.model("Invitation").deleteMany({
      expiresAt: { $lt: new Date() },
    });

    console.log("Cleaned up expired invitation tokens");
  } catch (error) {
    console.error("Error cleaning up old data:", error);
  }
}

/**
 * Check for expiring documents and send notifications
 */
async function checkExpiringDocuments() {
  try {
    console.log("📄 Checking for expiring documents");

    const thirtyDaysFromNow = dayjs().add(30, "day").toDate();

    // Find documents expiring in the next 30 days
    const expiringDocs = await mongoose
      .model("Document")
      .find({
        expiryDate: {
          $exists: true,
          $ne: null,
          $lte: thirtyDaysFromNow,
          $gt: new Date(),
        },
        notificationSent: { $ne: true },
      })
      .populate("employee");

    for (const doc of expiringDocs) {
      // Notify employee
      await emailService.sendDocumentExpiryNotification(doc.employee.email, {
        employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
        documentType: doc.type,
        expiryDate: dayjs(doc.expiryDate).format("MMMM D, YYYY"),
        daysLeft: dayjs(doc.expiryDate).diff(dayjs(), "day"),
      });

      // Mark notification as sent
      doc.notificationSent = true;
      await doc.save();

      console.log(`Expiration notification sent for document ${doc._id}`);
    }
  } catch (error) {
    console.error("Error checking for expiring documents:", error);
  }
}

/**
 * Update project statuses based on due dates
 */
async function updateProjectStatuses() {
  try {
    console.log("🔄 Updating project statuses");

    const today = new Date();

    // Find active projects
    const projects = await Project.find({
      status: { $in: ["planning", "inProgress"] },
    });

    for (const project of projects) {
      // Check if project has passed end date
      if (project.endDate && dayjs(project.endDate).isBefore(today)) {
        // Check if all tasks are complete
        const allTasksComplete = project.tasks.every(
          (task) => task.status === "completed"
        );

        if (allTasksComplete) {
          project.status = "completed";
          console.log(`Project ${project._id} marked as completed`);
        } else {
          // Project is overdue
          project.status = "overdue";
          console.log(`Project ${project._id} marked as overdue`);
        }

        await project.save();

        // Notify project stakeholders
        const assignedEmployees = await User.find({
          _id: { $in: project.assignedEmployees },
        });

        for (const employee of assignedEmployees) {
          await emailService.sendProjectStatusUpdateNotification(
            employee.email,
            {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              projectName: project.name,
              projectStatus: project.status,
              dueDate: dayjs(project.endDate).format("MMMM D, YYYY"),
            }
          );
        }
      }
      // Check if project should start today
      else if (
        project.status === "planning" &&
        project.startDate &&
        dayjs(project.startDate).isSameOrBefore(today)
      ) {
        project.status = "inProgress";
        await project.save();

        console.log(`Project ${project._id} marked as in progress`);

        // Notify assigned employees
        const assignedEmployees = await User.find({
          _id: { $in: project.assignedEmployees },
        });

        for (const employee of assignedEmployees) {
          await emailService.sendProjectStartNotification(employee.email, {
            employeeName: `${employee.firstName} ${employee.lastName}`,
            projectName: project.name,
            startDate: dayjs(project.startDate).format("MMMM D, YYYY"),
            endDate: dayjs(project.endDate).format("MMMM D, YYYY"),
          });
        }
      }
    }
  } catch (error) {
    console.error("Error updating project statuses:", error);
  }
}

module.exports = {
  initScheduledTasks,
};
