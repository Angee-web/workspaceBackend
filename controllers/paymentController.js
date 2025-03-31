const Payment = require('../models/Payment');
const User = require('../models/User');
const Company = require('../models/Company');
const Attendance = require('../models/Attendance');
const { processPayment } = require('../services/paymentService');
const { sendPaymentNotification } = require('../services/emailService');

/**
 * Process daily payments for all eligible employees
 * This would normally be called by a scheduled job at COB
 */
exports.processDailyPayments = async (req, res) => {
  try {
    // Admin only endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to process daily payments' 
      });
    }
    
    const today = new Date();
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][today.getDay()];
    
    // Find all employees who:
    // 1. Have clocked in and out today
    // 2. Today is in their working days
    // 3. Have remittance information set
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      },
      clockInTime: { $exists: true },
      clockOutTime: { $exists: true }
    });
    
    const employeeIds = attendanceRecords.map(record => record.employee);
    
    const employeesWithPaymentInfo = await User.find({
      _id: { $in: employeeIds },
      'employmentDetails.workingDays': dayName,
      'remittanceInfo.accountNumber': { $exists: true },
      'remittanceInfo.bankName': { $exists: true }
    }).populate('company');
    
    // Process payments
    const processedPayments = [];
    
    for (const employee of employeesWithPaymentInfo) {
      // Skip if payment already processed today
      const existingPayment = await Payment.findOne({
        employee: employee._id,
        date: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(23, 59, 59, 999)
        }
      });
      
      if (existingPayment) {
        continue;
      }
      
      // Get employee's daily rate
      const dailyRate = employee.employmentDetails.dailyRate || 
                         (employee.employmentDetails.wages / 
                          (employee.employmentDetails.workingDays.length * 4));
      
      // Check if company has sufficient balance
      const company = await Company.findById(employee.company);
      
      if (company.balance < dailyRate) {
        // Create failed payment record
        const failedPayment = new Payment({
          employee: employee._id,
          company: employee.company,
          amount: dailyRate,
          status: 'failed',
          failureReason: 'Insufficient company balance',
          date: new Date()
        });
        
        await failedPayment.save();
        processedPayments.push(failedPayment);
        continue;
      }
      
      // Find employee's attendance record for today
      const attendance = attendanceRecords.find(
        record => record.employee.toString() === employee._id.toString()
      );
      
      // Create payment
      const payment = new Payment({
        employee: employee._id,
        company: employee.company,
        amount: dailyRate,
        date: new Date(),
        status: 'pending',
        attendance: attendance._id,
        remittanceDetails: {
          bankName: employee.remittanceInfo.bankName,
          accountNumber: employee.remittanceInfo.accountNumber,
          accountName: employee.remittanceInfo.accountName,
          bankCode: employee.remittanceInfo.bankCode
        }
      });
      
      await payment.save();
      processedPayments.push(payment);
      
      // Send notification to employer
      const employer = await User.findOne({
        company: employee.company,
        role: 'employer'
      });
      
      if (employer) {
        await sendPaymentNotification(employer.email, {
          employeeName: `${employee.firstName} ${employee.lastName}`,
          amount: dailyRate,
          date: new Date().toDateString(),
          paymentId: payment._id
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Daily payments processed',
      count: processedPayments.length,
      data: processedPayments
    });
  } catch (error) {
    console.error('Error processing daily payments:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get payments for an employer's company
 */
exports.getCompanyPayments = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Query params
    const { startDate, endDate, status, employee } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = { company: user.company };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (employee) {
      query.employee = employee;
    }
    
    // Execute query
    const payments = await Payment.find(query)
      .populate('employee', 'firstName lastName email')
      .sort('-date')
      .skip(skip)
      .limit(limit);
    
    const total = await Payment.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: payments
    });
  } catch (error) {
    console.error('Error getting company payments:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get payments for an employee
 */
exports.getEmployeePayments = async (req, res) => {
  try {
    // Query params
    const { startDate, endDate, status } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = { employee: req.user.id };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    // Execute query
    const payments = await Payment.find(query)
      .populate('company', 'name')
      .sort('-date')
      .skip(skip)
      .limit(limit);
    
    const total = await Payment.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: payments
    });
  } catch (error) {
    console.error('Error getting employee payments:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Process a payment (for admin review of declined payments)
 */
exports.finalizePayment = async (req, res) => {
  try {
    // Admin only endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to finalize payments' 
      });
    }
    
    const { paymentId, action } = req.body;
    
    if (!paymentId || !action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment ID and valid action (approve/reject) are required' 
      });
    }
    
    // Find payment
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    // Only process payments that require admin review
    if (!payment.requiresAdminReview) {
      return res.status(400).json({ 
        success: false, 
        message: 'This payment does not require admin review' 
      });
    }
    
    if (action === 'approve') {
      // Process payment
      const company = await Company.findById(payment.company);
      
      // Check balance
      if (company.balance < payment.amount) {
        return res.status(400).json({ 
          success: false, 
          message: 'Insufficient company balance' 
        });
      }
      
      try {
        // Process payment via Paystack
        const paymentResult = await processPayment({
          amount: payment.amount * 100, // Convert to kobo
          email: payment.employee.email,
          reference: `pay_${payment._id}`,
          recipient: payment.remittanceDetails.accountNumber,
          bankCode: payment.remittanceDetails.bankCode
        });
        
        // Update payment
        payment.status = 'approved';
        payment.approvedBy = req.user.id;
        payment.approvedAt = Date.now();
        payment.transactionReference = paymentResult.reference;
        
        // Deduct from company balance
        company.balance -= payment.amount;
        await company.save();
      } catch (payError) {
        payment.status = 'failed';
        payment.failureReason = payError.message;
      }
    } else {
      // Reject payment
      payment.status = 'rejected';
      payment.rejectedBy = req.user.id;
      payment.rejectedAt = Date.now();
    }
    
    payment.requiresAdminReview = false;
    await payment.save();
    
    res.status(200).json({
      success: true,
      message: `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: payment
    });
  } catch (error) {
    console.error('Error finalizing payment:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get payment statistics
 */
/**
 * Get payment statistics
 */
exports.getPaymentStats = async (req, res) => {
  try {
    // Get timeframe
    const { timeframe } = req.query;
    const today = new Date();
    let startDate, endDate;
    
    switch(timeframe) {
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        endDate = today;
        break;
      case 'month':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        endDate = today;
        break;
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        endDate = today;
        break;
      default:
        // Default to last 30 days
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        endDate = today;
    }
    
    // Get user company
    const user = await User.findById(req.user.id);
    
    let query = {
      date: { $gte: startDate, $lte: endDate }
    };
    
    // Employer sees company payments, employees see own payments
    if (user.role === 'employer') {
      query.company = user.company;
    } else if (user.role === 'employee') {
      query.employee = user._id;
    }
    
    // Get payment statistics
    const stats = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }},
    ]);
    
    // Format stats
    const formattedStats = {};
    stats.forEach(stat => {
      formattedStats[stat._id] = {
        count: stat.count,
        total: stat.total
      };
    });
    
    // Get total by day
    const dailyStats = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: { 
          $dateToString: { format: "%Y-%m-%d", date: "$date" } 
        },
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Calculate overall summary
    const totalAmount = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);
    
    // Get payment methods breakdown
    const methodStats = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: '$remittanceDetails.bankName',
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }},
      { $sort: { total: -1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        byStatus: formattedStats,
        byDay: dailyStats,
        byMethod: methodStats,
        summary: totalAmount.length ? totalAmount[0] : { total: 0, count: 0 }
      }
    });
  } catch (error) {
    console.error('Error getting payment stats:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};