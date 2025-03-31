const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");
const { format } = require("date-fns");

class PDFService {
  constructor() {
    this.tempDir = path.join(__dirname, "../temp");

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async generateEmploymentContract(employeeData, companyData) {
    return new Promise(async (resolve, reject) => {
      try {
        const fileName = `employment_contract_${
          employeeData._id
        }_${Date.now()}.pdf`;
        const filePath = path.join(this.tempDir, fileName);

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        // Pipe PDF to writable stream
        doc.pipe(stream);

        // Add company logo if available
        if (companyData.logoUrl) {
          try {
            const logoPath = await this.downloadImage(companyData.logoUrl);
            doc.image(logoPath, {
              fit: [150, 150],
              align: "center",
            });
            // Clean up downloaded image
            fs.unlinkSync(logoPath);
          } catch (error) {
            console.error("Error adding logo to PDF:", error);
            // Continue without logo
          }
        }

        // Add document title
        doc
          .fontSize(20)
          .text("EMPLOYMENT CONTRACT", { align: "center" })
          .moveDown(2);

        // Add document date
        doc
          .fontSize(12)
          .text(`Date: ${format(new Date(), "MMMM dd, yyyy")}`, {
            align: "right",
          })
          .moveDown(2);

        // Add parties information
        doc
          .fontSize(12)
          .text("THIS EMPLOYMENT CONTRACT is made between:", {
            align: "center",
          })
          .moveDown();

        doc
          .fontSize(12)
          .text(`${companyData.name}`, { continued: true, bold: true })
          .text(', hereafter referred to as "Employer"')
          .text(`${companyData.address}`)
          .moveDown();

        doc.text("and").moveDown();

        doc
          .text(`${employeeData.firstName} ${employeeData.lastName}`, {
            continued: true,
            bold: true,
          })
          .text(', hereafter referred to as "Employee"')
          .moveDown(2);

        // Section 1: Position and duties
        doc
          .fontSize(14)
          .text("1. POSITION AND DUTIES", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(
            `1.1 The Employee is hired for the position of ${employeeData.designation}.`
          )
          .text(
            `1.2 The Employee will report to ${employeeData.supervisorName}.`
          )
          .text(
            "1.3 The Employee agrees to perform all duties required by this position and other related duties as assigned by the Employer."
          )
          .moveDown(2);

        // Section 2: Term of employment
        doc
          .fontSize(14)
          .text("2. TERM OF EMPLOYMENT", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(
            `2.1 This employment will commence on ${format(
              new Date(employeeData.startDate),
              "MMMM dd, yyyy"
            )}.`
          )
          .text(
            `2.2 This contract is for ${
              employeeData.contractType === "permanent"
                ? "permanent employment"
                : `a fixed term of ${employeeData.contractDuration}`
            }.`
          )
          .moveDown(2);

        // Section 3: Work schedule
        doc
          .fontSize(14)
          .text("3. WORK SCHEDULE", { underline: true })
          .moveDown();

        const workDays = employeeData.workingDays.join(", ");

        doc
          .fontSize(12)
          .text(
            `3.1 The Employee will work on the following days: ${workDays}.`
          )
          .text(
            `3.2 The normal working hours are from ${employeeData.workPeriod.start} to ${employeeData.workPeriod.end}.`
          )
          .text(
            `3.3 Break period: ${
              employeeData.breakPeriod
                ? `${employeeData.breakPeriod.start} to ${employeeData.breakPeriod.end}`
                : "N/A"
            }`
          )
          .moveDown(2);

        // Section 4: Compensation
        doc
          .fontSize(14)
          .text("4. COMPENSATION", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(
            `4.1 The Employee will receive a monthly salary of ${employeeData.monthlySalary}.`
          )
          .text(`4.2 Payment will be made daily at the Close of Business.`)
          .text(
            `4.3 The daily rate is calculated based on the monthly salary divided by the number of working days in a month.`
          )
          .moveDown(2);

        // Section 5: Benefits
        doc.fontSize(14).text("5. BENEFITS", { underline: true }).moveDown();

        doc.fontSize(12);

        if (employeeData.benefits && employeeData.benefits.length > 0) {
          employeeData.benefits.forEach((benefit, index) => {
            doc.text(`5.${index + 1} ${benefit.name}: ${benefit.description}`);
          });
        } else {
          doc.text("5.1 No additional benefits are included in this contract.");
        }

        doc.moveDown(2);

        // Section 6: Leave
        doc.fontSize(14).text("6. LEAVE", { underline: true }).moveDown();

        doc.fontSize(12);

        if (employeeData.leaves && employeeData.leaves.length > 0) {
          employeeData.leaves.forEach((leave, index) => {
            doc.text(
              `6.${index + 1} ${leave.type}: ${
                leave.daysPerYear
              } days per year.`
            );
          });
        } else {
          doc.text("6.1 Leave entitlements will be as per company policy.");
        }

        doc.moveDown(2);

        // Section 7: Termination
        doc.fontSize(14).text("7. TERMINATION", { underline: true }).moveDown();

        doc
          .fontSize(12)
          .text(
            "7.1 Either party may terminate this contract by providing written notice to the other party."
          )
          .text(
            "7.2 The Employer reserves the right to terminate employment immediately for gross misconduct or breach of contract."
          )
          .moveDown(2);

        // Section 8: Confidentiality
        doc
          .fontSize(14)
          .text("8. CONFIDENTIALITY", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(
            "8.1 The Employee agrees to keep all proprietary information of the Employer confidential during and after employment."
          )
          .moveDown(2);

        // Section 9: Governing Law
        doc
          .fontSize(14)
          .text("9. GOVERNING LAW", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(
            "9.1 This contract shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria."
          )
          .moveDown(2);

        // Signatures
        doc.fontSize(14).text("SIGNATURES", { align: "center" }).moveDown(2);

        doc
          .fontSize(12)
          .text("Employer: ____________________________", { align: "left" })
          .moveDown()
          .text("Employee: ____________________________", { align: "left" })
          .moveDown()
          .text("Date: ____________________________", { align: "left" });

        // Finalize PDF
        doc.end();

        // Wait for stream to finish
        stream.on("finish", async () => {
          try {
            // Upload PDF to Cloudinary
            const result = await cloudinary.uploader.upload(filePath, {
              folder: `companies/${companyData._id}/contracts`,
              resource_type: "raw",
            });

            // Delete temporary file
            fs.unlinkSync(filePath);

            // Return PDF information
            resolve({
              fileName,
              url: result.secure_url,
              publicId: result.public_id,
              size: result.bytes,
              format: result.format,
            });
          } catch (uploadError) {
            console.error("Error uploading PDF to Cloudinary:", uploadError);
            reject(new Error("Failed to upload contract PDF"));
          }
        });

        stream.on("error", (error) => {
          console.error("Error generating PDF:", error);
          reject(new Error("Failed to generate contract PDF"));
        });
      } catch (error) {
        console.error("Error in generateEmploymentContract:", error);
        reject(error);
      }
    });
  }

  async generateEfficiencyReport(
    employeeData,
    attendanceData,
    progressReports
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const fileName = `efficiency_report_${
          employeeData._id
        }_${Date.now()}.pdf`;
        const filePath = path.join(this.tempDir, fileName);

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        // Pipe PDF to writable stream
        doc.pipe(stream);

        // Add report title
        doc
          .fontSize(20)
          .text("EMPLOYEE DAILY EFFICIENCY REPORT", { align: "center" })
          .moveDown(2);

        // Add report date
        doc
          .fontSize(12)
          .text(`Date: ${format(new Date(), "MMMM dd, yyyy")}`, {
            align: "right",
          })
          .moveDown(2);

        // Add employee information
        doc
          .fontSize(14)
          .text("EMPLOYEE INFORMATION", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(`Name: ${employeeData.firstName} ${employeeData.lastName}`)
          .text(`Position: ${employeeData.designation}`)
          .text(`Department: ${employeeData.department || "N/A"}`)
          .moveDown(2);

        // Add attendance information
        doc
          .fontSize(14)
          .text("ATTENDANCE SUMMARY", { underline: true })
          .moveDown();

        doc
          .fontSize(12)
          .text(
            `Clock In: ${
              attendanceData.clockIn
                ? format(new Date(attendanceData.clockIn), "hh:mm a")
                : "Not recorded"
            }`
          )
          .text(
            `Clock Out: ${
              attendanceData.clockOut
                ? format(new Date(attendanceData.clockOut), "hh:mm a")
                : "Not recorded"
            }`
          )
          .moveDown();

        // Calculate total work hours if available
        if (attendanceData.clockIn && attendanceData.clockOut) {
          const clockInTime = new Date(attendanceData.clockIn);
          const clockOutTime = new Date(attendanceData.clockOut);
          const totalMinutes = Math.round(
            (clockOutTime - clockInTime) / (1000 * 60)
          );
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;

          doc
            .text(`Total Hours Worked: ${hours} hours and ${minutes} minutes`)
            .moveDown(2);
        }

        // Add face capture information
        doc
          .fontSize(14)
          .text("FACE RECOGNITION CAPTURES", { underline: true })
          .moveDown();

        if (
          attendanceData.faceCaptures &&
          attendanceData.faceCaptures.length > 0
        ) {
          doc
            .fontSize(12)
            .text(
              `Total Captures Attempted: ${attendanceData.faceCaptures.length}`
            )
            .text(
              `Successful Captures: ${
                attendanceData.faceCaptures.filter((c) => c.success).length
              }`
            )
            .text(
              `Presence Rate: ${Math.round(
                (attendanceData.faceCaptures.filter((c) => c.success).length /
                  attendanceData.faceCaptures.length) *
                  100
              )}%`
            )
            .moveDown();

          doc.text("Capture Details:").moveDown();

          // Table header
          const tableTop = doc.y;
          const tableLeft = 50;
          const colWidth = (doc.page.width - 100) / 3;

          doc
            .font("Helvetica-Bold")
            .text("Time", tableLeft, tableTop)
            .text("Status", tableLeft + colWidth, tableTop)
            .text("Notes", tableLeft + colWidth * 2, tableTop)
            .moveDown();

          // Table rows
          let yPosition = doc.y;
          attendanceData.faceCaptures.forEach((capture, index) => {
            const captureTime = format(new Date(capture.timestamp), "hh:mm a");
            const status = capture.success ? "Present" : "Absent";
            const notes = capture.notes || "";

            doc
              .font("Helvetica")
              .text(captureTime, tableLeft, yPosition)
              .text(status, tableLeft + colWidth, yPosition)
              .text(notes, tableLeft + colWidth * 2, yPosition);

            yPosition += 20;

            // Add a new page if we're close to the bottom
            if (yPosition > doc.page.height - 100) {
              doc.addPage();
              yPosition = 50;
            }
          });

          doc.moveDown(2);
        } else {
          doc
            .fontSize(12)
            .text("No face captures recorded for today.")
            .moveDown(2);
        }

        // Add progress reports
        doc
          .fontSize(14)
          .text("DAILY PROGRESS REPORTS", { underline: true })
          .moveDown();

        if (progressReports && progressReports.length > 0) {
          progressReports.forEach((report, index) => {
            doc
              .fontSize(12)
              .text(
                `Update ${index + 1}: ${format(
                  new Date(report.timestamp),
                  "hh:mm a"
                )}`
              )
              .moveDown();

            doc.text(report.content).moveDown(2);

            // Add a new page if we're close to the bottom
            if (
              doc.y > doc.page.height - 100 &&
              index < progressReports.length - 1
            ) {
              doc.addPage();
            }
          });
        } else {
          doc
            .fontSize(12)
            .text("No progress reports submitted for today.")
            .moveDown(2);
        }

        // Add summary and overall efficiency score
        doc
          .fontSize(14)
          .text("EFFICIENCY SUMMARY", { underline: true })
          .moveDown();

        // Calculate efficiency score based on attendance and reporting
        let attendanceScore = 0;
        let presenceScore = 0;
        let reportingScore = 0;

        // Attendance score
        if (attendanceData.clockIn && attendanceData.clockOut) {
          attendanceScore = 30; // Full score if both recorded
        } else if (attendanceData.clockIn || attendanceData.clockOut) {
          attendanceScore = 15; // Half score if only one recorded
        }

        // Presence score
        if (
          attendanceData.faceCaptures &&
          attendanceData.faceCaptures.length > 0
        ) {
          const successRate =
            attendanceData.faceCaptures.filter((c) => c.success).length /
            attendanceData.faceCaptures.length;
          presenceScore = Math.round(successRate * 50);
        }

        // Reporting score
        if (progressReports && progressReports.length > 0) {
          reportingScore = 20; // Full score if at least one report submitted
        }

        const totalScore = attendanceScore + presenceScore + reportingScore;

        doc
          .fontSize(12)
          .text(`Attendance Score: ${attendanceScore}/30`)
          .text(`Workplace Presence Score: ${presenceScore}/50`)
          .text(`Progress Reporting Score: ${reportingScore}/20`)
          .moveDown();

        doc
          .fontSize(16)
          .text(`Overall Efficiency Score: ${totalScore}%`, { underline: true })
          .moveDown(2);

        // Add signature line
        doc
          .text("Supervisor Signature: ____________________________", {
            align: "left",
          })
          .moveDown()
          .text("Date: ____________________________", { align: "left" });

        // Finalize PDF
        doc.end();

        // Wait for stream to finish
        stream.on("finish", async () => {
          try {
            // Upload PDF to Cloudinary
            const result = await cloudinary.uploader.upload(filePath, {
              folder: `companies/${companyData._id}/reports`,
              resource_type: "raw",
            });

            // Delete temporary file
            fs.unlinkSync(filePath);

            // Return PDF information
            resolve({
              fileName,
              url: result.secure_url,
              publicId: result.public_id,
              size: result.bytes,
              format: result.format,
            });
          } catch (uploadError) {
            console.error("Error uploading PDF to Cloudinary:", uploadError);
            reject(new Error("Failed to upload efficiency report PDF"));
          }
        });

        stream.on("error", (error) => {
          console.error("Error generating PDF:", error);
          reject(new Error("Failed to generate efficiency report PDF"));
        });
      } catch (error) {
        console.error("Error in generateEfficiencyReport:", error);
        reject(error);
      }
    });
  }

  async downloadImage(url) {
    const axios = require("axios");
    const { v4: uuidv4 } = require("uuid");

    try {
      const response = await axios({
        method: "GET",
        url: url,
        responseType: "arraybuffer",
      });

      const filePath = path.join(this.tempDir, `${uuidv4()}.png`);
      fs.writeFileSync(filePath, response.data);

      return filePath;
    } catch (error) {
      console.error("Error downloading image:", error);
      throw new Error("Failed to download image");
    }
  }
}

module.exports = new PDFService();
