const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  clockInTime: Date,
  clockOutTime: Date,
  clockInImage: String, // URL to stored face image
  clockOutImage: String,
  monitoringCaptures: [{
    time: Date,
    imageUrl: String,
    present: Boolean // Whether employee was detected in the image
  }],
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day', 'leave'],
    default: 'absent'
  },
  workingHours: Number,
  efficiencyReport: {
    rating: Number, // 0-100
    comments: String,
    presentCount: Number, // Number of times present during random captures
    totalCaptureAttempts: Number
  },
  dailyProgress: {
    description: String,
    tasks: [{
      name: String,
      completed: Boolean
    }]
  },
  location: {
    latitude: String,
    longitude: String,
    address: String
  }
}, { timestamps: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;
