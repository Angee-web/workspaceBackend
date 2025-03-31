const paystack = require("../config/paystack");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Company = require("../models/Company");
const emailService = require("./emailService");
const { format } = require("date-fns");

class PaymentService {
  /**
   * Initialize a new recipient on Paystack
   * @param {Object} employeeData - Employee information
   * @param {String} bankCode - Bank code
   * @param {String} accountNumber - Bank account number
   * @returns {Object} Recipient data
   */
  async createRecipient(employeeData, bankCode, accountNumber) {
    try {
      const response = await paystack.createTransferRecipient({
        type: "nuban",
        name: `${employeeData.firstName} ${employeeData.lastName}`,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
        metadata: {
          employee_id: employeeData._id.toString(),
        },
      });

      if (!response.status) {
        throw new Error(
          response.message || "Failed to create transfer recipient"
        );
      }

      return response.data;
    } catch (error) {
      console.error("Error creating transfer recipient:", error);
      throw new Error("Failed to create transfer recipient");
    }
  }

  /**
   * Verify bank account details
   * @param {String} accountNumber - Bank account number
   * @param {String} bankCode - Bank code
   * @returns {Object} Account verification data
   */
  async verifyBankAccount(accountNumber, bankCode) {
    try {
      const response = await paystack.resolveAccountNumber({
        account_number: accountNumber,
        bank_code: bankCode,
      });

      if (!response.status) {
        throw new Error(response.message || "Failed to verify bank account");
      }

      return response.data;
    } catch (error) {
      console.error("Error verifying bank account:", error);
      throw new Error("Failed to verify bank account");
    }
  }

  /**
   * Process daily payment to an employee
   * @param {Object} employeeData - Employee information
   * @param {Object} employerData - Employer information
   * @param {Object} companyData - Company information
   * @param {Date} date - Payment date (defaults to today)
   * @returns {Object} Payment data
   */
  async processDailyPayment(
    employeeData,
    employerData,
    companyData,
    date = new Date()
  ) {
    try {
      // Calculate daily amount
      const dailyAmount = await this.calculateDailyAmount(employeeData);

      // Check if employer has sufficient balance
      if (employerData.balance < dailyAmount) {
        throw new Error("Insufficient balance to process payment");
      }

      // Create payment record (pending status)
      const payment = await Payment.create({
        employee: employeeData._id,
        employer: employerData._id,
        company: companyData._id,
        amount: dailyAmount,
        type: "daily",
        status: "pending",
        date: date,
        description: `Daily payment for ${format(date, "yyyy-MM-dd")}`,
      });

      // Notify employer about pending payment
      await emailService.sendDailyPaymentPendingNotification(
        employerData,
        employeeData,
        dailyAmount,
        payment._id
      );

      return payment;
    } catch (error) {
      console.error("Error processing daily payment:", error);
      throw new Error("Failed to process daily payment");
    }
  }

  /**
   * Approve a pending payment
   * @param {String} paymentId - Payment ID
   * @param {Object} employerData - Employer information
   * @returns {Object} Updated payment data
   */
  async approvePayment(paymentId, employerData) {
    try {
      // Find payment record
      const payment = await Payment.findById(paymentId)
        .populate("employee")
        .populate("employer")
        .populate("company");

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== "pending") {
        throw new Error("Payment is not in pending status");
      }

      if (payment.employer._id.toString() !== employerData._id.toString()) {
        throw new Error("Unauthorized to approve this payment");
      }

      // Check if employer has sufficient balance
      if (employerData.balance < payment.amount) {
        throw new Error("Insufficient balance to process payment");
      }

      // Process payment via Paystack
      const transferResult = await this.initiateTransfer(
        payment.employee.paymentRecipientCode,
        payment.amount,
        `Daily payment for ${payment.employee.firstName} ${payment.employee.lastName}`
      );

      // Update payment record
      payment.status = "approved";
      payment.reference = transferResult.reference;
      payment.transferCode = transferResult.transfer_code;
      payment.approvedAt = new Date();
      payment.approvedBy = employerData._id;

      await payment.save();

      // Update employer balance
      await User.findByIdAndUpdate(employerData._id, {
        $inc: { balance: -payment.amount },
      });

      // Send notification to employee
      await emailService.sendPaymentNotification(
        payment.employee,
        payment.amount,
        payment.date
      );

      return payment;
    } catch (error) {
      console.error("Error approving payment:", error);
      throw new Error("Failed to approve payment");
    }
  }

  /**
   * Decline a pending payment
   * @param {String} paymentId - Payment ID
   * @param {Object} employerData - Employer information
   * @param {String} reason - Reason for declining
   * @returns {Object} Updated payment data
   */
  async declinePayment(paymentId, employerData, reason) {
    try {
      // Find payment record
      const payment = await Payment.findById(paymentId)
        .populate("employee")
        .populate("employer")
        .populate("company");

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== "pending") {
        throw new Error("Payment is not in pending status");
      }

      if (payment.employer._id.toString() !== employerData._id.toString()) {
        throw new Error("Unauthorized to decline this payment");
      }

      // Update payment record
      payment.status = "declined";
      payment.declinedAt = new Date();
      payment.declinedBy = employerData._id;
      payment.declineReason = reason;

      await payment.save();

      // Send notification to employee and admin
      await emailService.sendPaymentDeclinedNotification(
        payment.employee,
        employerData,
        reason
      );

      return payment;
    } catch (error) {
      console.error("Error declining payment:", error);
      throw new Error("Failed to decline payment");
    }
  }

  /**
   * Process payment after admin review (when employer declined)
   * @param {String} paymentId - Payment ID
   * @param {Object} adminData - Admin information
   * @param {Boolean} approve - Whether to approve or reject the payment
   * @param {String} reason - Admin's reason
   * @returns {Object} Updated payment data
   */
  async processAdminPaymentReview(paymentId, adminData, approve, reason) {
    try {
      // Find payment record
      const payment = await Payment.findById(paymentId)
        .populate("employee")
        .populate("employer")
        .populate("company");

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== "declined") {
        throw new Error("Payment is not in declined status");
      }

      if (approve) {
        // Check if employer has sufficient balance
        const employer = await User.findById(payment.employer._id);

        if (employer.balance < payment.amount) {
          throw new Error(
            "Employer has insufficient balance to process payment"
          );
        }

        // Process payment via Paystack
        const transferResult = await this.initiateTransfer(
          payment.employee.paymentRecipientCode,
          payment.amount,
          `Daily payment for ${payment.employee.firstName} ${payment.employee.lastName} (Admin approved)`
        );

        // Update payment record
        payment.status = "admin_approved";
        payment.reference = transferResult.reference;
        payment.transferCode = transferResult.transfer_code;
        payment.adminReviewedAt = new Date();
        payment.adminReviewedBy = adminData._id;
        payment.adminReviewNote = reason || "Approved by admin";

        await payment.save();

        // Update employer balance
        await User.findByIdAndUpdate(payment.employer._id, {
          $inc: { balance: -payment.amount },
        });

        // Send notification to employee and employer
        await emailService.sendAdminPaymentApprovalNotification(
          payment.employee,
          payment.employer,
          payment.amount,
          reason || "Approved by admin"
        );
      } else {
        // Update payment record
        payment.status = "admin_rejected";
        payment.adminReviewedAt = new Date();
        payment.adminReviewedBy = adminData._id;
        payment.adminReviewNote = reason || "Rejected by admin";

        await payment.save();

        // Send notification to employee and employer
        await emailService.sendAdminPaymentRejectionNotification(
          payment.employee,
          payment.employer,
          reason || "Rejected by admin"
        );
      }

      return payment;
    } catch (error) {
      console.error("Error processing admin payment review:", error);
      throw new Error("Failed to process admin payment review");
    }
  }

  /**
   * Add balance to employer account
   * @param {String} userId - Employer user ID
   * @param {Number} amount - Amount to add
   * @param {String} reference - Payment reference
   * @returns {Object} Updated employer data
   */
  async addEmployerBalance(userId, amount, reference) {
    try {
      // Update employer balance
      const employer = await User.findByIdAndUpdate(
        userId,
        { $inc: { balance: amount } },
        { new: true }
      );

      // Create payment record
      await Payment.create({
        employer: userId,
        amount: amount,
        type: "topup",
        status: "completed",
        date: new Date(),
        reference: reference,
        description: `Account top-up of ${amount}`,
      });

      return employer;
    } catch (error) {
      console.error("Error adding employer balance:", error);
      throw new Error("Failed to add employer balance");
    }
  }

  /**
   * Calculate daily payment amount for an employee
   * @param {Object} employeeData - Employee information
   * @returns {Number} Daily payment amount
   */
  async calculateDailyAmount(employeeData) {
    try {
      const monthlySalary = employeeData.monthlySalary || 0;
      const workingDaysPerMonth = employeeData.workingDays?.length * 4 || 20; // Assuming 4 weeks per month

      const dailyAmount = parseFloat(
        (monthlySalary / workingDaysPerMonth).toFixed(2)
      );

      return dailyAmount;
    } catch (error) {
      console.error("Error calculating daily amount:", error);
      throw new Error("Failed to calculate daily payment amount");
    }
  }

  /**
   * Verify payment webhook from Paystack
   * @param {Object} data - Webhook data
   * @returns {Boolean} Success status
   */
  async verifyPaymentWebhook(data) {
    try {
      if (data.event === "charge.success") {
        const reference = data.data.reference;

        // Check if this is a top-up payment
        const metadataRef = data.data.metadata?.reference_id;

        if (metadataRef && metadataRef.startsWith("topup_")) {
          const userId = metadataRef.split("_")[1];
          const amount = data.data.amount / 100; // Convert from kobo to naira

          await this.addEmployerBalance(userId, amount, reference);
        }

        return true;
      }

      if (data.event === "transfer.success") {
        const reference = data.data.reference;

        // Update payment status
        await Payment.findOneAndUpdate(
          { reference: reference },
          {
            status: "completed",
            completedAt: new Date(),
            transferData: data.data,
          },
          { new: true }
        );
        return true;
      }
    } catch (error) {
      console.error("Error verifying payment webhook:", error);
      throw new Error("Failed to verify payment webhook");
    }
  }
  /**
   * Handle failed transfers webhook from Paystack
   * @param {Object} data - Webhook data
   * @returns {Boolean} Success status
   */
  async handleFailedTransferWebhook(data) {
    try {
      if (data.event === "transfer.failed") {
        const reference = data.data.reference;

        // Update payment status to failed
        await findOneAndUpdate(
          { reference: reference },
          { status: "failed", failedAt: new Date(), transferData: data.data },
          { new: true }
        );

        return true;
      }
      return false;
    } catch (error) {
      console.error("Error handling failed transfer webhook:", error);
      return false;
    }
  }

  /**
   * Initiate a transfer to a recipient
   * @param {String} recipientCode - Paystack recipient code
   * @param {Number} amount - Amount to transfer
   * @param {String} reason - Reason for transfer
   * @returns {Object} Transfer response
   */
  async initiateTransfer(recipientCode, amount, reason) {
    try {
      const transferData = {
        source: "balance",
        amount: amount * 100, // Convert to kobo
        recipient: recipientCode,
        reason: reason,
        currency: "NGN",
      };

      const response = await paystackTransfer(transferData);

      if (!response.status) {
        throw new Error(response.message || "Transfer initiation failed");
      }

      return response.data;
    } catch (error) {
      console.error("Error initiating transfer:", error);
      throw new Error("Failed to initiate transfer");
    }
  }
}

module.exports = new PaymentService();
