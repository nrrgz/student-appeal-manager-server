const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const User = require("../models/User");
const { auth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// All routes require admin role
router.use(auth, requireAdmin);

// @route   GET /api/admin/appeals
// @desc    Get all appeals (admin view)
// @access  Private (Admin)
router.get("/appeals", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, appealType, department } = req.query;
    let query = {};

    // Apply filters
    if (status) query.status = status;
    if (appealType) query.appealType = appealType;
    if (department) {
      // Find students in the specified department
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      query.student = { $in: studentIds };
    }

    const skip = (page - 1) * limit;

    const appeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId department")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appeal.countDocuments(query);

    res.json({
      appeals,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get appeals error:", error);
    res.status(500).json({ message: "Server error while fetching appeals" });
  }
});

// @route   GET /api/admin/appeals/:id
// @desc    Get specific appeal by ID (admin view)
// @access  Private (Admin)
router.get("/appeals/:id", async (req, res) => {
  try {
    const appeal = await Appeal.findById(req.params.id)
      .populate("student", "firstName lastName email studentId department")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .populate("timeline.performedBy", "firstName lastName role")
      .populate("notes.author", "firstName lastName role");

    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    res.json({ appeal });
  } catch (error) {
    console.error("Get appeal error:", error);
    res.status(500).json({ message: "Server error while fetching appeal" });
  }
});

// @route   PUT /api/admin/appeals/:id/assign
// @desc    Assign reviewer/admin to appeal
// @access  Private (Admin)
router.put(
  "/appeals/:id/assign",
  [
    body("assignedReviewer").optional().isMongoId(),
    body("assignedAdmin").optional().isMongoId(),
    body("priority").optional().isIn(["low", "medium", "high", "urgent"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const appeal = await Appeal.findById(req.params.id);
      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }

      const { assignedReviewer, assignedAdmin, priority } = req.body;
      const updates = {};

      if (assignedReviewer) updates.assignedReviewer = assignedReviewer;
      if (assignedAdmin) updates.assignedAdmin = assignedAdmin;
      if (priority) updates.priority = priority;

      // Add to timeline
      const timelineEntry = {
        action: "Appeal assigned",
        description: `Updated by admin: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      if (assignedReviewer) {
        timelineEntry.description += ` - Reviewer assigned`;
      }
      if (assignedAdmin) {
        timelineEntry.description += ` - Admin assigned`;
      }
      if (priority) {
        timelineEntry.description += ` - Priority set to ${priority}`;
      }

      updates.timeline = [...appeal.timeline, timelineEntry];

      const updatedAppeal = await Appeal.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      )
        .populate("student", "firstName lastName email studentId")
        .populate("assignedReviewer", "firstName lastName")
        .populate("assignedAdmin", "firstName lastName");

      res.json({
        message: "Appeal assigned successfully",
        appeal: updatedAppeal,
      });
    } catch (error) {
      console.error("Appeal assignment error:", error);
      res
        .status(500)
        .json({ message: "Server error during appeal assignment" });
    }
  }
);

// @route   GET /api/admin/appeals/dashboard
// @desc    Get admin appeal statistics for dashboard
// @access  Private (Admin)
router.get("/appeals/dashboard", async (req, res) => {
  try {
    // Get appeals by status
    const statusCounts = await Appeal.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get appeals by type
    const typeCounts = await Appeal.aggregate([
      {
        $group: {
          _id: "$appealType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get appeals by department
    const departmentCounts = await Appeal.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "student",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $unwind: "$studentInfo",
      },
      {
        $group: {
          _id: "$studentInfo.department",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent appeals
    const recentAppeals = await Appeal.find()
      .populate("student", "firstName lastName email studentId department")
      .sort({ createdAt: -1 })
      .limit(10);

    // Format status counts
    const statusSummary = {
      submitted: 0,
      "under review": 0,
      "awaiting information": 0,
      "decision made": 0,
      resolved: 0,
      rejected: 0,
    };

    statusCounts.forEach((item) => {
      statusSummary[item._id] = item.count;
    });

    res.json({
      statusSummary,
      typeCounts,
      departmentCounts,
      recentAppeals,
      total: Object.values(statusSummary).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching dashboard data" });
  }
});

// @route   GET /api/admin/appeals/search
// @desc    Search appeals with filters (admin view)
// @access  Private (Admin)
router.get("/appeals/search", async (req, res) => {
  try {
    const {
      status,
      appealType,
      grounds,
      academicYear,
      semester,
      department,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

    // Apply filters
    if (status) query.status = status;
    if (appealType) query.appealType = appealType;
    if (grounds) query.grounds = { $in: [grounds] };
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = semester;
    if (department) {
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      query.student = { $in: studentIds };
    }

    const skip = (page - 1) * limit;

    const appeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId department")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appeal.countDocuments(query);

    res.json({
      appeals,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error while searching appeals" });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin)
router.get("/users", async (req, res) => {
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

// @route   GET /api/admin/users/reviewers
// @desc    Get all reviewers
// @access  Private (Admin)
router.get("/users/reviewers", async (req, res) => {
  try {
    const reviewers = await User.find({ role: "reviewer", isActive: true })
      .select("-password")
      .sort({ firstName: 1, lastName: 1 });

    res.json({ reviewers });
  } catch (error) {
    console.error("Get reviewers error:", error);
    res.status(500).json({ message: "Server error while fetching reviewers" });
  }
});

// @route   GET /api/admin/users/stats
// @desc    Get system statistics
// @access  Private (Admin)
router.get("/users/stats", async (req, res) => {
  try {
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          active: {
            $sum: { $cond: ["$isActive", 1, 0] },
          },
        },
      },
    ]);

    const appealStats = await Appeal.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalUsers = userStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalAppeals = appealStats.reduce((sum, stat) => sum + stat.count, 0);

    res.json({
      users: {
        total: totalUsers,
        byRole: userStats,
      },
      appeals: {
        total: totalAppeals,
        byStatus: appealStats,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ message: "Server error while fetching statistics" });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private (Admin)
router.put(
  "/users/:id",
  [
    body("firstName").optional().trim(),
    body("lastName").optional().trim(),
    body("department").optional().trim(),
    body("isActive").optional().isBoolean(),
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

      const { firstName, lastName, department, isActive } = req.body;
      const updates = {};

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (department) updates.department = department;
      if (typeof isActive === "boolean") updates.isActive = isActive;

      const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Server error while updating user" });
    }
  }
);

// @route   DELETE /api/admin/users/:id
// @desc    Deactivate user
// @access  Private (Admin)
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't allow admin to deactivate themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "Cannot deactivate your own account" });
    }

    user.isActive = false;
    await user.save();

    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({ message: "Server error while deactivating user" });
  }
});

module.exports = router;
