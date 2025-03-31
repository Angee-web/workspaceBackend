const nodemailer = require("nodemailer");
const config = require("../config/emailConfig");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async sendEmail(to, subject, template, data) {
    try {
      const templatePath = path.join(
        __dirname,
        "../views/emails",
        `${template}.ejs`
      );
      const html = await ejs.renderFile(templatePath, data);

      const mailOptions = {
        from: `"HR Management" <${config.user}>`,
        to,
        subject,
        html,
      };

      return await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send email");
    }
  }

  async sendEmployeeInvitation(employee, company, password, invitationLink) {
    const data = {
      employee,
      company,
      password,
      invitationLink,
    };

    return this.sendEmail(
      employee.email,
      `Invitation to join ${company.name}`,
      "employeeInvitation",
      data
    );
  }

  async sendEmployeeTermination(employee, company, reason) {
    const data = {
      employee,
      company,
      reason,
      terminationDate: new Date(),
    };

    return this.sendEmail(
      employee.email,
      `Termination of Employment with ${company.name}`,
      "employeeTermination",
      data
    );
  }

  async sendDailyEfficiencyReport(employee, employer, efficiencyData) {
    const data = {
      employee,
      employer,
      efficiencyData,
      date: new Date(),
    };

    return this.sendEmail(
      employer.email,
      `Daily Efficiency Report: ${employee.firstName} ${employee.lastName}`,
      "dailyEfficiencyReport",
      data
    );
  }

  async sendPaymentNotification(employee, amount, date) {
    const data = {
      employee,
      amount,
      date,
    };

    return this.sendEmail(
      employee.email,
      "Daily Payment Notification",
      "paymentNotification",
      data
    );
  }

  async sendPaymentDeclinedNotification(employee, employer, reason) {
    const data = {
      employee,
      employer,
      reason,
      date: new Date(),
    };

    return this.sendEmail(
      [employee.email, employer.email],
      "Payment Declined Notification",
      "paymentDeclined",
      data
    );
  }

  async sendInterviewInvitation(applicant, job, interviewLink) {
    const data = {
      applicant,
      job,
      interviewLink,
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    };

    return this.sendEmail(
      applicant.email,
      `Interview Invitation: ${job.title} at ${job.company.name}`,
      "interviewInvitation",
      data
    );
  }

  async sendVerificationCode(email, code) {
    const data = {
      code,
      expiresIn: "10 minutes",
    };

    return this.sendEmail(
      email,
      "Email Verification Code",
      "verificationCode",
      data
    );
  }
}

module.exports = new EmailService();
