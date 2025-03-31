/**
 * General helper functions for the HR Management System
 */

const dayjs = require("dayjs");
const crypto = require("crypto");

/**
 * Generate a random string for tokens, temporary passwords, etc.
 * @param {number} length - Length of the random string
 * @returns {string} - Random string
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};

/**
 * Calculate daily pay rate based on monthly salary and working days
 * @param {number} monthlySalary - Monthly salary amount
 * @param {number} workingDaysPerMonth - Number of working days in a month
 * @returns {number} - Daily pay rate
 */
const calculateDailyPayRate = (monthlySalary, workingDaysPerMonth) => {
  if (!monthlySalary || !workingDaysPerMonth) return 0;
  return parseFloat((monthlySalary / workingDaysPerMonth).toFixed(2));
};

/**
 * Check if a time is within work hours
 * @param {string} currentTime - Current time (HH:mm format)
 * @param {string} workStartTime - Work start time (HH:mm format)
 * @param {string} workEndTime - Work end time (HH:mm format)
 * @param {Array<Object>} breakPeriods - Array of break periods with start and end times
 * @returns {boolean} - Whether the current time is within work hours
 */
const isWorkingHour = (
  currentTime,
  workStartTime,
  workEndTime,
  breakPeriods = []
) => {
  const current = dayjs(`2023-01-01T${currentTime}`);
  const start = dayjs(`2023-01-01T${workStartTime}`);
  const end = dayjs(`2023-01-01T${workEndTime}`);

  // Check if current time is outside work hours
  if (current.isBefore(start) || current.isAfter(end)) {
    return false;
  }

  // Check if current time is during a break
  for (const breakPeriod of breakPeriods) {
    const breakStart = dayjs(`2023-01-01T${breakPeriod.startTime}`);
    const breakEnd = dayjs(`2023-01-01T${breakPeriod.endTime}`);

    if (current.isAfter(breakStart) && current.isBefore(breakEnd)) {
      return false;
    }
  }

  return true;
};

/**
 * Generate random times for employee monitoring within work hours
 * @param {string} workStartTime - Work start time (HH:mm format)
 * @param {string} workEndTime - Work end time (HH:mm format)
 * @param {Array<Object>} breakPeriods - Array of break periods with start and end times
 * @param {number} count - Number of times to generate
 * @returns {Array<string>} - Array of random times (HH:mm format)
 */
const generateRandomMonitoringTimes = (
  workStartTime,
  workEndTime,
  breakPeriods = [],
  count = 10
) => {
  const start = dayjs(`2023-01-01T${workStartTime}`);
  const end = dayjs(`2023-01-01T${workEndTime}`);
  const totalMinutes = end.diff(start, "minute");

  // Create an array of all possible minutes in the work day
  const allMinutes = [];
  for (let i = 0; i <= totalMinutes; i++) {
    const timePoint = start.add(i, "minute");
    const timeString = timePoint.format("HH:mm");

    if (isWorkingHour(timeString, workStartTime, workEndTime, breakPeriods)) {
      allMinutes.push(timeString);
    }
  }

  // Select random times from the valid working minutes
  const randomTimes = [];
  const timesCount = Math.min(count, allMinutes.length);

  for (let i = 0; i < timesCount; i++) {
    const randomIndex = Math.floor(Math.random() * allMinutes.length);
    randomTimes.push(allMinutes[randomIndex]);
    allMinutes.splice(randomIndex, 1); // Remove the selected time to avoid duplicates
  }

  return randomTimes.sort((a, b) => {
    return dayjs(`2023-01-01T${a}`).diff(dayjs(`2023-01-01T${b}`));
  });
};

/**
 * Calculate employee efficiency based on attendance
 * @param {number} present - Number of times employee was present
 * @param {number} total - Total number of monitoring attempts
 * @returns {number} - Efficiency percentage
 */
const calculateEfficiency = (present, total) => {
  if (!total) return 0;
  return parseFloat(((present / total) * 100).toFixed(2));
};

/**
 * Generate an invitation token with expiry
 * @returns {Object} - Token and expiry date
 */
const generateInvitationToken = () => {
  const token = generateRandomString(32);
  const expires = dayjs().add(7, "day").toDate(); // Token valid for 7 days

  return { token, expires };
};

/**
 * Check if a date is a working day based on employee's working days
 * @param {Date} date - Date to check
 * @param {Array<number>} workingDays - Array of working days (0-6, where 0 is Sunday)
 * @returns {boolean} - Whether the date is a working day
 */
const isWorkingDay = (date, workingDays) => {
  const dayOfWeek = dayjs(date).day();
  return workingDays.includes(dayOfWeek);
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: NGN)
 * @returns {string} - Formatted currency amount
 */
const formatCurrency = (amount, currency = "NGN") => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(amount);
};

/**
 * Parse CSV data for bulk operations
 * @param {string} csvData - CSV data as string
 * @returns {Array<Object>} - Array of objects representing CSV rows
 */
const parseCSV = (csvData) => {
  const lines = csvData.split("\n");
  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    return row;
  });
};

/**
 * Generate a pagination object
 * @param {number} totalItems - Total number of items
 * @param {number} currentPage - Current page number
 * @param {number} pageSize - Number of items per page
 * @returns {Object} - Pagination object
 */
const getPagination = (totalItems, currentPage = 1, pageSize = 10) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return {
    totalItems,
    currentPage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? currentPage + 1 : null,
    prevPage: hasPrevPage ? currentPage - 1 : null,
  };
};

/**
 * Calculate working hours for efficiency report
 * @param {Date} clockIn - Clock in time
 * @param {Date} clockOut - Clock out time
 * @param {Array<Object>} breaks - Array of break periods with start and end times
 * @returns {number} - Total working hours
 */
const calculateWorkingHours = (clockIn, clockOut, breaks = []) => {
  if (!clockIn || !clockOut) return 0;

  let totalMinutes = dayjs(clockOut).diff(dayjs(clockIn), "minute");

  // Subtract break times
  breaks.forEach((breakPeriod) => {
    const breakStart = dayjs(breakPeriod.startTime);
    const breakEnd = dayjs(breakPeriod.endTime);

    // Only count breaks that fall within the clock in/out period
    if (breakStart.isAfter(clockIn) && breakEnd.isBefore(clockOut)) {
      totalMinutes -= breakEnd.diff(breakStart, "minute");
    }
  });

  return parseFloat((totalMinutes / 60).toFixed(2));
};

module.exports = {
  generateRandomString,
  calculateDailyPayRate,
  isWorkingHour,
  generateRandomMonitoringTimes,
  calculateEfficiency,
  generateInvitationToken,
  isWorkingDay,
  formatCurrency,
  parseCSV,
  getPagination,
  calculateWorkingHours,
};
