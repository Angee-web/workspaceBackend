const User = require('../models/User');
const Document = require('../models/Document');
const Project = require('../models/Project');
const Attendance = require('../models/Attendance');
const { cloudinaryUpload } = require('../config/cloudinary');
const { validateDocument } = require('../utils/validators');
const { compareFaces } = require('../services/faceService');

/**
 * Update verification documents
 */
exports.uploadVerificationDocument = async (req, res) => {
  try {
    const { type, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }
    
    if (!type || !['nin', 'utility', 'other'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid document type is required (nin, utility, other)' 
      });
    }
    
    const { error } = validateDocument(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    
    // Upload document to Cloudinary
    const result = await cloudinaryUpload(req.file.path, 'verification-documents');
    
    // Create document record
    const document = new Document({
      user: req.user.id,
      type,
      description,
      fileUrl: result.secure_url,
      status: 'pending' // Pending verification
    });
    
    await document.save();
    
    // Update user document count
    const user = await User.findById(req.user.id);
    if (!user.verificationDocuments) {
      user.verificationDocuments = [];
    }
    
    user.verificationDocuments.push(document._id);
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Update remittance information
 */
exports.updateRemittanceInfo = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, bankCode } = req.body;
    
    if (!bankName || !accountNumber || !accountName || !bankCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'All remittance fields are required' 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        remittanceInfo: {
          bankName,
          accountNumber,
          accountName,
          bankCode
        }
      },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Remittance information updated successfully',
      data: user.remittanceInfo
    });
  } catch (error) {
    console.error('Error updating remittance info:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Clock in
 */
exports.clockIn = async (req, res) => {
  try {
    // Verify face recognition
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Face image is required' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user.profilePicture) {
      return res.status(400).json({ 
        success: false, 
        message: 'Profile picture not set. Cannot verify identity.' 
      });
    }
    
    // Upload face image
    const result = await cloudinaryUpload(req.file.path, 'face-recognition');
    
    // Compare faces
    const isMatch = await compareFaces(user.profilePicture, result.secure_url);
    
    if (!isMatch) {
      return res.status(403).json({ 
        success: false, 
        message: 'Face recognition failed. Please try again.' 
      });
    }
    
    // Check if already clocked in
    const existingAttendance = await Attendance.findOne({
      employee: req.user.id,
      date: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      },
      clockOutTime: null
    });
    
    if (existingAttendance) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already clocked in. Please clock out first.' 
      });
    }
    
    // Create attendance record
    const attendance = new Attendance({
      employee: req.user.id,
      company: user.company,
      date: new Date(),
      clockInTime: new Date(),
      faceImageIn: result.secure_url
    });
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: 'Clocked in successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Clock out
 */
exports.clockOut = async (req, res) => {
  try {
    // Verify face recognition
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Face image is required' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Upload face image
    const result = await cloudinaryUpload(req.file.path, 'face-recognition');
    
    // Compare faces
    const isMatch = await compareFaces(user.profilePicture, result.secure_url);
    
    if (!isMatch) {
      return res.status(403).json({ 
        success: false, 
        message: 'Face recognition failed. Please try again.' 
      });
    }
    
    // Find current attendance record
    const attendance = await Attendance.findOne({
      employee: req.user.id,
      date: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      },
      clockOutTime: null
    });
    
    if (!attendance) {
      return res.status(400).json({ 
        success: false, 
        message: 'No active clock-in found. Please clock in first.' 
      });
    }
    
    // Update attendance record
    attendance.clockOutTime = new Date();
    attendance.faceImageOut = result.secure_url;
    attendance.hoursWorked = (attendance.clockOutTime - attendance.clockInTime) / (1000 * 60 * 60);
    
    await attendance.save();
    
    res.status(200).json({
      success: true,
      message: 'Clocked out successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error clocking out:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Submit daily progress report
 */
exports.submitProgressReport = async (req, res) => {
  try {
    const { summary, tasksCompleted, challenges, nextSteps, projectId } =
      req.body;
    if (!summary) {
      return res.status(400).json({
        success: false,
        message: "Progress summary is required",
      });
    }

    // Find current attendance record
    const attendance = await Attendance.findOne({
      employee: req.user.id,
      date: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999),
      },
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "No attendance record for today. Please clock in first.",
      });
    }

    // Update attendance with progress report
    attendance.progressReport = {
      summary,
      tasksCompleted: tasksCompleted || [],
      challenges: challenges || [],
      nextSteps: nextSteps || [],
      submittedAt: new Date(),
    };

    await attendance.save();

    // If project is specified, update project progress as well
    if (projectId) {
      const project = await Project.findById(projectId);

      if (!project) {
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      }

      // Check if user is assigned to the project
      if (!project.assignees.includes(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this project",
        });
      }

      // Add progress update to project
      project.progressUpdates.push({
        employee: req.user.id,
        summary,
        date: new Date(),
      });

      await project.save();
    }

    res.status(200).json({
      success: true,
      message: "Progress report submitted successfully",
      data: attendance.progressReport,
    });
  } catch (error) {
    console.error("Error submitting progress report:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Complete project
 */
exports.completeProject = async (req, res) => {
  try {
    const { projectId, completionNotes } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    // Find project
    const project = await Project.findById(projectId);

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check if user is assigned to the project
    if (!project.assignees.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this project",
      });
    }

    // Update project status
    project.status = "completed";
    project.completedDate = new Date();
    project.completionNotes = completionNotes;

    await project.save();

    res.status(200).json({
      success: true,
      message: "Project marked as completed",
      data: project,
    });
  } catch (error) {
    console.error("Error completing project:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get employee work details
 */
exports.getWorkDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("employmentDetails");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: user.employmentDetails,
    });
  } catch (error) {
    console.error("Error getting work details:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Submit interview response
 */
exports.submitInterviewResponse = async (req, res) => {
  try {
    const { interviewId, questionId } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Video response is required" });
    }

    // Upload video to Cloudinary
    const result = await cloudinaryUpload(req.file.path, "interview-responses");

    // Find the interview
    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res
        .status(404)
        .json({ success: false, message: "Interview not found" });
    }

    // Find the question
    const question = interview.questions.id(questionId);

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    // Check if applicant exists or create new
    let applicant = await User.findOne({
      email: req.body.email,
      role: "applicant",
    });

    if (!applicant) {
      applicant = new User({
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: "applicant",
      });

      await applicant.save();
    }

    // Add response to interview
    if (!interview.responses) {
      interview.responses = [];
    }

    interview.responses.push({
      applicant: applicant._id,
      question: questionId,
      responseUrl: result.secure_url,
      submittedAt: new Date(),
    });

    await interview.save();

    res.status(200).json({
      success: true,
      message: "Interview response submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting interview response:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};