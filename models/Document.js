const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['nin', 'utility_bill', 'other_verification_1', 'other_verification_2', 'other_verification_3', 'employment_contract'],
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  cloudinaryId: String,
  mimeType: String,
  fileName: String,
  fileSize: Number,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: Date,
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  comments: String
}, { timestamps: true });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
