const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  jobTitle: {
    type: String,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: String,
  requirements: [String],
  questions: [{
    questionText: {
      type: String,
      required: true
    },
    maxDuration: { // Maximum time to answer in seconds
      type: Number,
      default: 60
    },
    order: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  applications: [{
    applicantName: String,
    applicantEmail: {
      type: String,
      required: true
    },
    applicationDate: {
      type: Date,
      default: Date.now
    },
    resume: String, // URL to stored resume
    responses: [{
      questionId: mongoose.Schema.Types.ObjectId,
      videoUrl: String,
      duration: Number,
      submittedAt: Date
    }],
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'reviewed', 'selected', 'rejected'],
      default: 'pending'
    },
    reviewNotes: String,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: Number // 1-5 rating
  }],
  expiryDate: Date
}, { timestamps: true });

const Interview = mongoose.model('Interview', interviewSchema);
module.exports = Interview;