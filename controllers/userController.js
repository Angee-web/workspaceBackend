const User = require("../models/User");
const Company = require("../models/Company");
const { cloudinaryUpload } = require("../config/cloudinary");
const { validateProfile } = require("../utils/validators");

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Error getting profile:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { error } = validateProfile(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    const updates = { ...req.body };
    delete updates.role; // Prevent role modification

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    res
      .status(200)
      .json({
        success: true,
        data: user,
        message: "Profile updated successfully",
      });
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Upload profile picture
 */
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Please upload an image file" });
    }

    const result = await cloudinaryUpload(req.file.path, "profile-pictures");

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: result.secure_url },
      { new: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      data: user,
      message: "Profile picture uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Change phone number
 */
exports.updatePhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { phoneNumber },
      { new: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      data: user,
      message: "Phone number updated successfully",
    });
  } catch (error) {
    console.error("Error updating phone number:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get user company details
 */
exports.getCompanyDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.company) {
      return res
        .status(404)
        .json({
          success: false,
          message: "User not associated with any company",
        });
    }

    const company = await Company.findById(user.company);

    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }

    res.status(200).json({ success: true, data: company });
  } catch (error) {
    console.error("Error getting company details:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
