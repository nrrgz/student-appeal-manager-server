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

// @route   PUT /api/admin/appeals/:id/priority
// @desc    Update appeal priority
// @access  Private (Admin)
router.put(
  "/appeals/:id/priority",
  [
    body("priority")
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Valid priority is required"),
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

      const { priority } = req.body;

      // Add to timeline
      const timelineEntry = {
        action: "Priority updated",
        description: `Priority changed to ${priority} by admin: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      const updatedAppeal = await Appeal.findByIdAndUpdate(
        req.params.id,
        {
          priority,
          timeline: [...appeal.timeline, timelineEntry],
        },
        { new: true, runValidators: true }
      )
        .populate("student", "firstName lastName email studentId")
        .populate("assignedReviewer", "firstName lastName")
        .populate("assignedAdmin", "firstName lastName");

      res.json({
        message: "Appeal priority updated successfully",
        appeal: updatedAppeal,
      });
    } catch (error) {
      console.error("Priority update error:", error);
      res.status(500).json({ message: "Server error during priority update" });
    }
  }
);

// @route   PUT /api/admin/appeals/:id/status
// @desc    Update appeal status
// @access  Private (Admin)
router.put(
  "/appeals/:id/status",
  [
    body("status")
      .isIn([
        "submitted",
        "under review",
        "awaiting information",
        "decision made",
        "resolved",
        "rejected",
      ])
      .withMessage("Valid status is required"),
    body("notes").optional().trim(),
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

      const { status, notes } = req.body;

      // Add to timeline
      const timelineEntry = {
        action: "Status updated",
        description: `Status changed to ${status} by admin: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      const updates = {
        status,
        timeline: [...appeal.timeline, timelineEntry],
      };

      // Add admin note if provided
      if (notes) {
        const noteEntry = {
          content: notes,
          author: req.user._id,
          role: "admin",
          isInternal: true,
          createdAt: new Date(),
        };
        updates.notes = [...appeal.notes, noteEntry];
      }

      const updatedAppeal = await Appeal.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      )
        .populate("student", "firstName lastName email studentId")
        .populate("assignedReviewer", "firstName lastName")
        .populate("assignedAdmin", "firstName lastName")
        .populate("notes.author", "firstName lastName role");

      res.json({
        message: "Appeal status updated successfully",
        appeal: updatedAppeal,
      });
    } catch (error) {
      console.error("Status update error:", error);
      res.status(500).json({ message: "Server error during status update" });
    }
  }
);

// @route   POST /api/admin/appeals/:id/notes
// @desc    Add admin note to appeal
// @access  Private (Admin)
router.post(
  "/appeals/:id/notes",
  [
    body("content").trim().notEmpty().withMessage("Note content is required"),
    body("isInternal").optional().isBoolean(),
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

      const { content, isInternal = true } = req.body;

      const noteEntry = {
        content,
        author: req.user._id,
        role: "admin",
        isInternal,
        createdAt: new Date(),
      };

      // Add to timeline
      const timelineEntry = {
        action: "Admin note added",
        description: `Note added by admin: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      const updatedAppeal = await Appeal.findByIdAndUpdate(
        req.params.id,
        {
          notes: [...appeal.notes, noteEntry],
          timeline: [...appeal.timeline, timelineEntry],
        },
        { new: true, runValidators: true }
      )
        .populate("student", "firstName lastName email studentId")
        .populate("assignedReviewer", "firstName lastName")
        .populate("assignedAdmin", "firstName lastName")
        .populate("notes.author", "firstName lastName role");

      res.json({
        message: "Admin note added successfully",
        appeal: updatedAppeal,
      });
    } catch (error) {
      console.error("Add note error:", error);
      res.status(500).json({ message: "Server error while adding note" });
    }
  }
);

// @route   POST /api/admin/appeals/bulk-assign
// @desc    Bulk assign appeals to reviewers/admins
// @access  Private (Admin)
router.post(
  "/appeals/bulk-assign",
  [
    body("appealIds")
      .isArray({ min: 1 })
      .withMessage("At least one appeal ID is required"),
    body("appealIds.*").isMongoId().withMessage("Invalid appeal ID"),
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

      const { appealIds, assignedReviewer, assignedAdmin, priority } = req.body;

      const results = [];
      const errorList = [];

      for (const appealId of appealIds) {
        try {
          const appeal = await Appeal.findById(appealId);
          if (!appeal) {
            errorList.push({ appealId, error: "Appeal not found" });
            continue;
          }

          const updates = {};
          if (assignedReviewer) updates.assignedReviewer = assignedReviewer;
          if (assignedAdmin) updates.assignedAdmin = assignedAdmin;
          if (priority) updates.priority = priority;

          // Add to timeline
          const timelineEntry = {
            action: "Bulk assignment",
            description: `Bulk assigned by admin: ${req.user.firstName} ${req.user.lastName}`,
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
            appealId,
            updates,
            { new: true, runValidators: true }
          )
            .populate("student", "firstName lastName email studentId")
            .populate("assignedReviewer", "firstName lastName")
            .populate("assignedAdmin", "firstName lastName");

          results.push(updatedAppeal);
        } catch (error) {
          errorList.push({ appealId, error: error.message });
        }
      }

      res.json({
        message: `Bulk assignment completed. ${results.length} appeals updated.`,
        results,
        errors: errorList.length > 0 ? errorList : undefined,
      });
    } catch (error) {
      console.error("Bulk assignment error:", error);
      res.status(500).json({ message: "Server error during bulk assignment" });
    }
  }
);

// @route   GET /api/admin/reports/appeals
// @desc    Get detailed appeal reports and statistics
// @access  Private (Admin)
router.get("/reports/appeals", async (req, res) => {
  try {
    const { dateRange = "30", department, appealType } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    let matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (department) {
      // Find students in the specified department
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      matchStage.student = { $in: studentIds };
    }

    if (appealType) {
      matchStage.appealType = appealType;
    }

    // Get appeals by status with date range
    const statusCounts = await Appeal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get appeals by type with date range
    const typeCounts = await Appeal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$appealType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get appeals by department with date range
    const departmentCounts = await Appeal.aggregate([
      { $match: matchStage },
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

    // Get resolution time statistics
    const resolutionStats = await Appeal.aggregate([
      {
        $match: {
          ...matchStage,
          status: { $in: ["resolved", "decision made"] },
        },
      },
      {
        $addFields: {
          resolutionTime: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: "$resolutionTime" },
          minResolutionTime: { $min: "$resolutionTime" },
          maxResolutionTime: { $max: "$resolutionTime" },
          totalResolved: { $sum: 1 },
        },
      },
    ]);

    // Get monthly trends
    const monthlyTrends = await Appeal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          appeals: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [
                { $in: ["$status", ["resolved", "decision made"]] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
      {
        $limit: 12,
      },
    ]);

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

    // Format monthly trends
    const formattedMonthlyTrends = monthlyTrends.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      appeals: item.appeals,
      resolved: item.resolved,
    }));

    res.json({
      dateRange: parseInt(dateRange),
      statusSummary,
      typeCounts,
      departmentCounts,
      resolutionStats: resolutionStats[0] || {
        avgResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0,
        totalResolved: 0,
      },
      monthlyTrends: formattedMonthlyTrends,
      total: Object.values(statusSummary).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("Reports error:", error);
    res.status(500).json({ message: "Server error while generating reports" });
  }
});

module.exports = router;
