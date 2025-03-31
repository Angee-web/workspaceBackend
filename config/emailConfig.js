// config/emailConfig.js
const nodemailer = require("nodemailer");

// Create transporter with environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send email using nodemailer
 * @param {Object} mailOptions - Email options (to, subject, html, etc.)
 * @returns {Promise} - Nodemailer response
 */
const sendEmail = async (mailOptions) => {
  try {
    // Set default from address if not provided
    mailOptions.from =
      mailOptions.from ||
      `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`;

    // Send mail
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Error sending email: ${error.message}`);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  employeeInvitation: (data) => {
    return {
      subject: `Invitation to join ${data.companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited to join ${data.companyName}</h2>
          <p>Hello ${data.employeeName},</p>
          <p>${data.employerName} has invited you to join their team on the HR Management Platform.</p>
          <p><strong>Your Role:</strong> ${data.role}</p>
          <p><strong>Start Date:</strong> ${data.startDate}</p>
          <p>To accept this invitation and set up your account, please click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invitationLink}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          <p>This invitation will expire in 7 days.</p>
          <p>If you have any questions, please contact ${data.employerName} at ${data.employerEmail}.</p>
          <p>Best regards,<br>HR Management Team</p>
        </div>
      `,
    };
  },

  passwordReset: (data) => {
    return {
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${data.name},</p>
          <p>We received a request to reset your password. To proceed with the password reset, please click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetLink}" style="background-color: #2196F3; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>Best regards,<br>HR Management Team</p>
        </div>
      `,
    };
  },

  dailyReport: (data) => {
    return {
      subject: `Daily Efficiency Report: ${data.employeeName} - ${data.date}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Daily Efficiency Report</h2>
          <p>Hello ${data.employerName},</p>
          <p>Here is the daily efficiency report for ${data.employeeName} on ${
        data.date
      }:</p>
          
          <div style="background-color: #f2f2f2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Clock In:</strong> ${data.clockInTime}</p>
            <p><strong>Clock Out:</strong> ${
              data.clockOutTime || "Not clocked out yet"
            }</p>
            <p><strong>Working Hours:</strong> ${data.workingHours || "N/A"}</p>
            <p><strong>Efficiency Rating:</strong> ${
              data.efficiencyRating
            }/100</p>
            <p><strong>Present During Monitoring:</strong> ${
              data.presentCount
            }/${data.totalMonitoring}</p>
          </div>
          
          <h3>Daily Progress Report:</h3>
          <p>${data.progressReport}</p>
          
          <p>To review the complete details, please log in to your dashboard:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${
              data.dashboardLink
            }" style="background-color: #607D8B; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              View Dashboard
            </a>
          </div>
          
          <p>You have one hour to review and approve the daily payment.</p>
          
          <p>Best regards,<br>HR Management Team</p>
        </div>
      `,
    };
  },
};

module.exports = {
  transporter,
  sendEmail,
  emailTemplates,
};
