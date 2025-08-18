const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Appeal = require("../models/Appeal");
const {
  auth,
  requireAdmin,
  requireAdminOrReviewer,
} = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin)
router.get("/", auth, requireAdmin, async (req, res) => {
  try {
    const { role, department, page = 1, limit = 10 } = req.query;

    let query = {};

    if (role) query.role = role;
    if (department) query.department = department;

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
});

// @route   GET /api/users/reviewers
// @desc    Get all reviewers (for assignment purposes)
// @access  Private (Admin/Reviewer)
router.get("/reviewers", auth, requireAdminOrReviewer, async (req, res) => {
  try {
    const reviewers = await User.find({
      role: "reviewer",
      isActive: true,
    })
      .select("firstName lastName email department")
      .sort({ firstName: 1, lastName: 1 });

    res.json({ reviewers });
  } catch (error) {
    console.error("Get reviewers error:", error);
    res.status(500).json({ message: "Server error while fetching reviewers" });
  }
});

// @route   GET /api/users/admins
// @desc    Get all admins (for assignment purposes)
// @access  Private (Admin)
router.get("/admins", auth, requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({
      role: "admin",
      isActive: true,
    })
      .select("firstName lastName email department")
      .sort({ firstName: 1, lastName: 1 });

    res.json({ admins });
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({ message: "Server error while fetching admins" });
  }
});

// @route   GET /api/users/search
// @desc    Search users with filters
// @access  Private (Admin)
router.get("/search", auth, requireAdmin, async (req, res) => {
  try {
    const {
      query,
      role,
      department,
      isActive,
      page = 1,
      limit = 10,
    } = req.query;

    let searchQuery = {};

    // Text search
    if (query) {
      searchQuery.$or = [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { studentId: { $regex: query, $options: "i" } },
      ];
    }

    // Role filter
    if (role) searchQuery.role = role;

    // Department filter
    if (department) searchQuery.department = department;

    // Active status filter
    if (typeof isActive === "boolean") searchQuery.isActive = isActive;

    const skip = (page - 1) * limit;

    const users = await User.find(searchQuery)
      .select("-password")
      .sort({ firstName: 1, lastName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(searchQuery);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ message: "Server error while searching users" });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check access permissions
    if (
      req.user.role === "student" &&
      req.user._id.toString() !== req.params.id
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error while fetching user" });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin only, or own profile)
// @access  Private
router.put(
  "/:id",
  [
    auth,
    body("firstName").optional().trim().notEmpty(),
    body("lastName").optional().trim().notEmpty(),
    body("department").optional().trim(),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { firstName, lastName, department, isActive } = req.body;
      const updates = {};

      // Check if user can update this profile
      const canUpdate =
        req.user.role === "admin" || req.user._id.toString() === req.params.id;

      if (!canUpdate) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Only admins can update isActive status
      if (isActive !== undefined && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admins can change account status" });
      }

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (department && req.user.role === "admin")
        updates.department = department;
      if (isActive !== undefined && req.user.role === "admin")
        updates.isActive = isActive;

      const user = await User.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: "User updated successfully",
        user,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Server error while updating user" });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Deactivate user (admin only)
// @access  Private (Admin)
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has active appeals
    const activeAppeals = await Appeal.countDocuments({
      student: req.params.id,
      status: { $in: ["submitted", "under review", "awaiting information"] },
    });

    if (activeAppeals > 0) {
      return res.status(400).json({
        message: `Cannot deactivate user with ${activeAppeals} active appeals`,
      });
    }

    // Deactivate user instead of deleting
    user.isActive = false;
    await user.save();

    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({ message: "Server error while deactivating user" });
  }
});

// @route   GET /api/users/:id/appeals
// @desc    Get appeals for a specific user
// @access  Private
router.get("/:id/appeals", auth, async (req, res) => {
  try {
    // Check access permissions
    if (
      req.user.role === "student" &&
      req.user._id.toString() !== req.params.id
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const appeals = await Appeal.find({ student: req.params.id })
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json({ appeals });
  } catch (error) {
    console.error("Get user appeals error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching user appeals" });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get user statistics overview (admin only)
// @access  Private (Admin)
router.get("/stats/overview", auth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const students = await User.countDocuments({
      role: "student",
      isActive: true,
    });
    const admins = await User.countDocuments({ role: "admin", isActive: true });
    const reviewers = await User.countDocuments({
      role: "reviewer",
      isActive: true,
    });

    const totalAppeals = await Appeal.countDocuments();
    const pendingAppeals = await Appeal.countDocuments({
      status: { $in: ["submitted", "under review", "awaiting information"] },
    });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        students,
        admins,
        reviewers,
      },
      appeals: {
        total: totalAppeals,
        pending: pendingAppeals,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ message: "Server error while fetching statistics" });
  }
});

// @route   PUT /api/users/:id/activate
// @desc    Activate deactivated user
// @access  Private (Admin)
router.put("/:id/activate", auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isActive) {
      return res.status(400).json({ message: "User is already active" });
    }

    user.isActive = true;
    await user.save();

    res.json({
      message: "User activated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Activate user error:", error);
    res.status(500).json({ message: "Server error while activating user" });
  }
});

// @route   PUT /api/users/:id/password
// @desc    Reset user password (admin only)
// @access  Private (Admin)
router.put(
  "/:id/password",
  [
    auth,
    requireAdmin,
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { newPassword } = req.body;

      // Set new password (will be hashed by pre-save hook)
      user.password = newPassword;
      await user.save();

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res
        .status(500)
        .json({ message: "Server error while resetting password" });
    }
  }
);

// @route   GET /api/users/:id/activity
// @desc    Get user activity summary
// @access  Private (Admin/Reviewer or own user)
router.get("/:id/activity", auth, async (req, res) => {
  try {
    // Check access permissions
    if (
      req.user.role === "student" &&
      req.user._id.toString() !== req.params.id
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's appeals
    const appeals = await Appeal.find({ student: req.params.id })
      .select("status appealType createdAt")
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's review assignments (if reviewer)
    let reviewAssignments = [];
    if (user.role === "reviewer") {
      reviewAssignments = await Appeal.find({ assignedReviewer: req.params.id })
        .select("status appealType createdAt")
        .sort({ createdAt: -1 })
        .limit(10);
    }

    // Get user's admin assignments (if admin)
    let adminAssignments = [];
    if (user.role === "admin") {
      adminAssignments = await Appeal.find({ assignedAdmin: req.params.id })
        .select("status appealType createdAt")
        .sort({ createdAt: -1 })
        .limit(10);
    }

    const activity = {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
      },
      appeals: appeals,
      reviewAssignments: reviewAssignments,
      adminAssignments: adminAssignments,
      summary: {
        totalAppeals: appeals.length,
        totalReviews: reviewAssignments.length,
        totalAdminAssignments: adminAssignments.length,
      },
    };

    res.json({ activity });
  } catch (error) {
    console.error("Get user activity error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching user activity" });
  }
});

module.exports = router;
