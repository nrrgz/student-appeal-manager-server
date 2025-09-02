const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const User = require("../models/User");
const { auth, requireAdmin } = require("../middleware/auth");
const path = require("path");
const fs = require("fs-extra");

const router = express.Router();

router.use(auth, requireAdmin);

router.get("/appeals/:id/evidence/:filename/download", async (req, res) => {
  try {
    const { id, filename } = req.params;

    console.log("Admin download request:", { id, filename });

    const appeal = await Appeal.findById(id);

    if (!appeal) {
      console.log("Appeal not found for admin:", id);
      return res.status(404).json({ message: "Appeal not found" });
    }

    console.log("Appeal found:", appeal._id);
    console.log("Appeal evidence:", appeal.evidence);

    const evidenceFile = appeal.evidence.find(
      (file) => file.filename === filename || file.originalName === filename
    );

    console.log("Evidence file found:", evidenceFile);

    if (!evidenceFile) {
      console.log("Evidence file not found for filename:", filename);
      return res.status(404).json({ message: "Evidence file not found" });
    }

    const filePath = path.join(
      __dirname,
      "..",
      "uploads",
      evidenceFile.filename
    );

    if (!(await fs.pathExists(filePath))) {
      console.log("File not found on server:", filePath);
      return res.status(404).json({ message: "File not found on server" });
    }

    res.setHeader(
      "Content-Type",
      evidenceFile.mimeType || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${
        evidenceFile.originalName || evidenceFile.filename
      }"`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Admin download evidence error:", error);
    res.status(500).json({ message: "Server error while downloading file" });
  }
});

router.get("/appeals", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      appealType,
      department,
      assignedReviewer,
      assignedAdmin,
    } = req.query;
    let query = {};

    if (status) query.status = status;
    if (appealType) query.appealType = appealType;
    if (department) {
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      query.student = { $in: studentIds };
    }
    if (assignedReviewer) {
      if (assignedReviewer === "unassigned") {
        query.assignedReviewer = { $exists: false };
      } else {
        query.assignedReviewer = assignedReviewer;
      }
    }
    if (assignedAdmin) {
      if (assignedAdmin === "unassigned") {
        query.assignedAdmin = { $exists: false };
      } else {
        query.assignedAdmin = assignedAdmin;
      }
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

router.get("/appeals/dashboard", async (req, res) => {
  try {
    const statusCounts = await Appeal.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const typeCounts = await Appeal.aggregate([
      {
        $group: {
          _id: "$appealType",
          count: { $sum: 1 },
        },
      },
    ]);

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

    const recentAppeals = await Appeal.find()
      .populate("student", "firstName lastName email studentId department")
      .sort({ createdAt: -1 })
      .limit(10);

    const deadlineStats = await Appeal.aggregate([
      {
        $facet: {
          totalWithDeadlines: [
            { $match: { deadline: { $exists: true, $ne: null } } },
            { $count: "count" },
          ],
          overdue: [
            { $match: { deadline: { $lt: new Date() } } },
            { $count: "count" },
          ],
          dueToday: [
            {
              $match: {
                deadline: {
                  $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  $lt: new Date(new Date().setHours(23, 59, 59, 999)),
                },
              },
            },
            { $count: "count" },
          ],
          dueThisWeek: [
            {
              $match: {
                deadline: {
                  $gte: new Date(),
                  $lte: new Date(new Date().setDate(new Date().getDate() + 7)),
                },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalAppeals = await Appeal.countDocuments({});

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

    const deadlineSummary = {
      totalWithDeadlines: deadlineStats[0]?.totalWithDeadlines[0]?.count || 0,
      overdue: deadlineStats[0]?.overdue[0]?.count || 0,
      dueToday: deadlineStats[0]?.dueToday[0]?.count || 0,
      dueThisWeek: deadlineStats[0]?.dueThisWeek[0]?.count || 0,
    };

    const assignmentStats = await Appeal.aggregate([
      {
        $facet: {
          assignedToReviewer: [
            { $match: { assignedReviewer: { $exists: true, $ne: null } } },
            { $count: "count" },
          ],
          assignedToAdmin: [
            { $match: { assignedAdmin: { $exists: true, $ne: null } } },
            { $count: "count" },
          ],
          unassigned: [
            {
              $match: {
                assignedReviewer: { $exists: false },
                assignedAdmin: { $exists: false },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const assignmentSummary = {
      assignedToReviewer: assignmentStats[0]?.assignedToReviewer[0]?.count || 0,
      assignedToAdmin: assignmentStats[0]?.assignedToAdmin[0]?.count || 0,
      unassigned: assignmentStats[0]?.unassigned[0]?.count || 0,
    };

    res.json({
      statusSummary,
      typeCounts,
      departmentCounts,
      recentAppeals,
      deadlineSummary,
      assignmentSummary,
      total: totalAppeals,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching dashboard data" });
  }
});

router.get("/appeals/search", async (req, res) => {
  try {
    const {
      status,
      appealType,
      grounds,
      academicYear,
      semester,
      department,
      assignedReviewer,
      assignedAdmin,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

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
    if (assignedReviewer) {
      if (assignedReviewer === "unassigned") {
        query.assignedReviewer = { $exists: false };
      } else {
        query.assignedReviewer = assignedReviewer;
      }
    }
    if (assignedAdmin) {
      if (assignedAdmin === "unassigned") {
        query.assignedAdmin = { $exists: false };
      } else {
        query.assignedAdmin = assignedAdmin;
      }
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

router.put(
  "/appeals/:id/assign",
  [
    body("assignedReviewer")
      .optional()
      .custom((value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === "string" && value.trim() === "") return true;

        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("assignedReviewer must be a valid MongoDB ObjectId or null"),
    body("assignedAdmin")
      .optional()
      .custom((value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === "string" && value.trim() === "") return true;

        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("assignedAdmin must be a valid MongoDB ObjectId or null"),
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

      if (assignedReviewer !== undefined)
        updates.assignedReviewer = assignedReviewer;
      if (assignedAdmin !== undefined) updates.assignedAdmin = assignedAdmin;
      if (priority !== undefined) updates.priority = priority;

      const timelineEntry = {
        action: "Appeal assigned",
        description: `Updated by admin: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      if (assignedReviewer !== undefined) {
        if (assignedReviewer) {
          timelineEntry.description += ` - Reviewer assigned`;
        } else {
          timelineEntry.description += ` - Reviewer unassigned`;
        }
      }
      if (assignedAdmin !== undefined) {
        if (assignedAdmin) {
          timelineEntry.description += ` - Admin assigned`;
        } else {
          timelineEntry.description += ` - Admin unassigned`;
        }
      }
      if (priority !== undefined) {
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

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

      const timelineEntry = {
        action: "Status updated",
        description: `Status changed to ${status} by admin: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      const updates = {
        status,
        timeline: [...appeal.timeline, timelineEntry],
      };

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

router.delete("/appeals/:id/notes/:noteId", async (req, res) => {
  try {
    const { id, noteId } = req.params;

    const appeal = await Appeal.findById(id);
    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    const noteIndex = appeal.notes.findIndex(
      (note) => note._id.toString() === noteId
    );

    if (noteIndex === -1) {
      return res.status(404).json({ message: "Note not found" });
    }

    const note = appeal.notes[noteIndex];
    if (
      note.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this note" });
    }

    appeal.notes.splice(noteIndex, 1);

    const timelineEntry = {
      action: "Admin note deleted",
      description: `Note deleted by admin: ${req.user.firstName} ${req.user.lastName}`,
      performedBy: req.user._id,
    };

    appeal.timeline.push(timelineEntry);

    await appeal.save();

    const updatedAppeal = await Appeal.findById(id)
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .populate("notes.author", "firstName lastName role");

    res.json({
      message: "Note deleted successfully",
      appeal: updatedAppeal,
    });
  } catch (error) {
    console.error("Delete note error:", error);
    res.status(500).json({ message: "Server error while deleting note" });
  }
});

router.post(
  "/appeals/bulk-assign",
  [
    body("appealIds")
      .isArray({ min: 1 })
      .withMessage("At least one appeal ID is required"),
    body("appealIds.*").isMongoId().withMessage("Invalid appeal ID"),
    body("assignedReviewer")
      .optional()
      .custom((value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === "string" && value.trim() === "") return true;

        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("assignedReviewer must be a valid MongoDB ObjectId or null"),
    body("assignedAdmin")
      .optional()
      .custom((value) => {
        if (value === null || value === undefined) return true;
        if (typeof value === "string" && value.trim() === "") return true;

        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("assignedAdmin must be a valid MongoDB ObjectId or null"),
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
          if (assignedReviewer !== undefined)
            updates.assignedReviewer = assignedReviewer;
          if (assignedAdmin !== undefined)
            updates.assignedAdmin = assignedAdmin;
          if (priority !== undefined) updates.priority = priority;

          const timelineEntry = {
            action: "Bulk assignment",
            description: `Bulk assigned by admin: ${req.user.firstName} ${req.user.lastName}`,
            performedBy: req.user._id,
          };

          if (assignedReviewer !== undefined) {
            if (assignedReviewer) {
              timelineEntry.description += ` - Reviewer assigned`;
            } else {
              timelineEntry.description += ` - Reviewer unassigned`;
            }
          }
          if (assignedAdmin !== undefined) {
            if (assignedAdmin) {
              timelineEntry.description += ` - Admin assigned`;
            } else {
              timelineEntry.description += ` - Admin unassigned`;
            }
          }
          if (priority !== undefined) {
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

router.get("/reports/appeals", async (req, res) => {
  try {
    const { dateRange = "30", department, appealType } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    let matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (department) {
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      matchStage.student = { $in: studentIds };
    }

    if (appealType) {
      matchStage.appealType = appealType;
    }

    const statusCounts = await Appeal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const typeCounts = await Appeal.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$appealType",
          count: { $sum: 1 },
        },
      },
    ]);

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
              1000 * 60 * 60 * 24,
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

    const resolutionTimeDistribution = await Appeal.aggregate([
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
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ["$resolutionTime", 2] }, then: "0-2 days" },
                { case: { $lt: ["$resolutionTime", 5] }, then: "3-5 days" },
                { case: { $lt: ["$resolutionTime", 10] }, then: "6-10 days" },
                { case: { $gte: ["$resolutionTime", 10] }, then: "10+ days" },
              ],
              default: "Unknown",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

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

    const groundsStats = await Appeal.aggregate([
      { $match: matchStage },
      {
        $unwind: "$grounds",
      },
      {
        $group: {
          _id: "$grounds",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

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

    const formattedMonthlyTrends = monthlyTrends.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      appeals: item.appeals,
      resolved: item.resolved,
    }));

    const formattedResolutionTimes = {
      "0-2 days": 0,
      "3-5 days": 0,
      "6-10 days": 0,
      "10+ days": 0,
    };

    resolutionTimeDistribution.forEach((item) => {
      if (formattedResolutionTimes.hasOwnProperty(item._id)) {
        formattedResolutionTimes[item._id] = item.count;
      }
    });

    const total = Object.values(statusSummary).reduce((a, b) => a + b, 0);

    res.json({
      dateRange: parseInt(dateRange),
      statusSummary,
      typeCounts,
      departmentCounts,
      groundsStats,
      resolutionStats: resolutionStats[0] || {
        avgResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0,
        totalResolved: 0,
      },
      resolutionTimeDistribution: formattedResolutionTimes,
      monthlyTrends: formattedMonthlyTrends,
      total,

      pendingAppeals:
        statusSummary.submitted +
        statusSummary["under review"] +
        statusSummary["awaiting information"],
      resolvedAppeals: statusSummary["decision made"] + statusSummary.resolved,
      rejectedAppeals: statusSummary.rejected,
    });
  } catch (error) {
    console.error("Reports error:", error);
    res.status(500).json({ message: "Server error while generating reports" });
  }
});

router.get("/reports/comprehensive", async (req, res) => {
  try {
    const { dateRange = "30", department, appealType } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    let matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (department) {
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      matchStage.student = { $in: studentIds };
    }

    if (appealType) {
      matchStage.appealType = appealType;
    }

    const [
      statusCounts,
      typeCounts,
      departmentCounts,
      resolutionStats,
      resolutionTimeDistribution,
      monthlyTrends,
      groundsStats,
      totalCount,
    ] = await Promise.all([
      Appeal.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      Appeal.aggregate([
        { $match: matchStage },
        { $group: { _id: "$appealType", count: { $sum: 1 } } },
      ]),

      Appeal.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "users",
            localField: "student",
            foreignField: "_id",
            as: "studentInfo",
          },
        },
        { $unwind: "$studentInfo" },
        { $group: { _id: "$studentInfo.department", count: { $sum: 1 } } },
      ]),

      Appeal.aggregate([
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
                1000 * 60 * 60 * 24,
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
      ]),

      Appeal.aggregate([
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
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ["$resolutionTime", 2] }, then: "0-2 days" },
                  { case: { $lt: ["$resolutionTime", 5] }, then: "3-5 days" },
                  { case: { $lt: ["$resolutionTime", 10] }, then: "6-10 days" },
                  { case: { $gte: ["$resolutionTime", 10] }, then: "10+ days" },
                ],
                default: "Unknown",
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),

      Appeal.aggregate([
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
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),

      Appeal.aggregate([
        { $match: matchStage },
        { $unwind: "$grounds" },
        { $group: { _id: "$grounds", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      Appeal.countDocuments(matchStage),
    ]);

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

    const formattedResolutionTimes = {
      "0-2 days": 0,
      "3-5 days": 0,
      "6-10 days": 0,
      "10+ days": 0,
    };

    resolutionTimeDistribution.forEach((item) => {
      if (formattedResolutionTimes.hasOwnProperty(item._id)) {
        formattedResolutionTimes[item._id] = item.count;
      }
    });

    const formattedMonthlyTrends = monthlyTrends.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      appeals: item.appeals,
      resolved: item.resolved,
    }));

    const pendingAppeals =
      statusSummary.submitted +
      statusSummary["under review"] +
      statusSummary["awaiting information"];
    const resolvedAppeals =
      statusSummary["decision made"] + statusSummary.resolved;
    const rejectedAppeals = statusSummary.rejected;
    const successRate =
      totalCount > 0 ? Math.round((resolvedAppeals / totalCount) * 100) : 0;

    res.json({
      dateRange: parseInt(dateRange),
      total: totalCount,
      statusSummary,
      typeCounts,
      departmentCounts,
      groundsStats,
      resolutionStats: resolutionStats[0] || {
        avgResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0,
        totalResolved: 0,
      },
      resolutionTimeDistribution: formattedResolutionTimes,
      monthlyTrends: formattedMonthlyTrends,

      pendingAppeals,
      resolvedAppeals,
      rejectedAppeals,
      successRate,
      averageResolutionTime:
        Math.round((resolutionStats[0]?.avgResolutionTime || 0) * 10) / 10,
    });
  } catch (error) {
    console.error("Comprehensive reports error:", error);
    res
      .status(500)
      .json({ message: "Server error while generating comprehensive reports" });
  }
});

router.get("/reports/export-csv", async (req, res) => {
  try {
    const { dateRange = "30", department, appealType } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    let matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (department) {
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      matchStage.student = { $in: studentIds };
    }

    if (appealType) {
      matchStage.appealType = appealType;
    }

    const appeals = await Appeal.find(matchStage)
      .populate("student", "firstName lastName email studentId department")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ createdAt: -1 });

    console.log(`Found ${appeals.length} appeals for CSV export`);
    if (appeals.length > 0) {
      console.log("First appeal createdAt:", appeals[0].createdAt);
      console.log(
        "First appeal formatted date:",
        new Date(appeals[0].createdAt).toISOString().split("T")[0]
      );
    }

    const csvHeaders = [
      "Appeal ID",
      "Student Name",
      "Student ID",
      "Department",
      "Email",
      "Appeal Type",
      "Grounds",
      "Status",
      "Priority",
      "Submitted Date",
      "Assigned Reviewer",
      "Assigned Admin",
      "Resolution Time (days)",
    ];

    const csvRows = appeals.map((appeal) => {
      const resolutionTime =
        appeal.status === "resolved" || appeal.status === "decision made"
          ? Math.round(
              (new Date(appeal.updatedAt) - new Date(appeal.createdAt)) /
                (1000 * 60 * 60 * 24)
            )
          : "";

      const submittedDate = appeal.createdAt
        ? new Date(appeal.createdAt).toISOString().split("T")[0]
        : appeal.submittedDate
        ? new Date(appeal.submittedDate).toISOString().split("T")[0]
        : "N/A";

      return [
        appeal.appealId || appeal._id,
        `${appeal.student?.firstName || appeal.firstName} ${
          appeal.student?.lastName || appeal.lastName
        }`,
        appeal.student?.studentId || appeal.studentId,
        appeal.student?.department || appeal.department,
        appeal.student?.email || appeal.email,
        appeal.appealType,
        Array.isArray(appeal.grounds)
          ? appeal.grounds.join("; ")
          : appeal.grounds,
        appeal.status,
        appeal.priority || "",
        submittedDate,
        appeal.assignedReviewer
          ? `${appeal.assignedReviewer.firstName} ${appeal.assignedReviewer.lastName}`
          : "",
        appeal.assignedAdmin
          ? `${appeal.assignedAdmin.firstName} ${appeal.assignedAdmin.lastName}`
          : "",
        resolutionTime,
      ]
        .map((field) => `"${String(field || "").replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");

    console.log("CSV Headers:", csvHeaders.join(","));
    if (csvRows.length > 0) {
      console.log("First CSV Row:", csvRows[0]);
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="appeal-reports-${
        new Date().toISOString().split("T")[0]
      }.csv"`
    );

    res.send(csvContent);
  } catch (error) {
    console.error("CSV export error:", error);
    res.status(500).json({ message: "Server error while exporting CSV" });
  }
});

router.put("/appeals/:id/deadline", async (req, res) => {
  try {
    const { id } = req.params;
    const { deadline, reason } = req.body;

    if (!deadline) {
      return res.status(400).json({ message: "Deadline is required" });
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: "Invalid deadline format" });
    }

    if (deadlineDate <= new Date()) {
      return res
        .status(400)
        .json({ message: "Deadline must be in the future" });
    }

    const appeal = await Appeal.findById(id);
    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    appeal.deadline = deadlineDate;

    appeal.timeline.push({
      action: "deadline_set",
      description: `Deadline set to ${deadlineDate.toLocaleDateString()}${
        reason ? ` - Reason: ${reason}` : ""
      }`,
      performedBy: req.user._id,
      timestamp: new Date(),
    });

    if (reason) {
      appeal.notes.push({
        content: `Deadline set: ${deadlineDate.toLocaleDateString()}. Reason: ${reason}`,
        author: req.user._id,
        timestamp: new Date(),
        isInternal: true,
      });
    }

    await appeal.save();

    await appeal.populate(
      "student",
      "firstName lastName email studentId department"
    );
    await appeal.populate("assignedReviewer", "firstName lastName");
    await appeal.populate("assignedAdmin", "firstName lastName");

    res.json({
      message: "Deadline set successfully",
      appeal: {
        _id: appeal._id,
        appealId: appeal.appealId,
        deadline: appeal.deadline,
        status: appeal.status,
        student: appeal.student,
        assignedReviewer: appeal.assignedReviewer,
        assignedAdmin: appeal.assignedAdmin,
      },
    });
  } catch (error) {
    console.error("Set deadline error:", error);
    res.status(500).json({ message: "Server error while setting deadline" });
  }
});

router.delete("/appeals/:id/deadline", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appeal = await Appeal.findById(id);
    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    appeal.deadline = undefined;

    appeal.timeline.push({
      action: "deadline_removed",
      description: `Deadline removed${reason ? ` - Reason: ${reason}` : ""}`,
      performedBy: req.user._id,
      timestamp: new Date(),
    });

    if (reason) {
      appeal.notes.push({
        content: `Deadline removed. Reason: ${reason}`,
        author: req.user._id,
        timestamp: new Date(),
        isInternal: true,
      });
    }

    await appeal.save();

    await appeal.populate(
      "student",
      "firstName lastName email studentId department"
    );
    await appeal.populate("assignedReviewer", "firstName lastName");
    await appeal.populate("assignedAdmin", "firstName lastName");

    res.json({
      message: "Deadline removed successfully",
      appeal: {
        _id: appeal._id,
        appealId: appeal.appealId,
        deadline: appeal.deadline,
        status: appeal.status,
        student: appeal.student,
        assignedReviewer: appeal.assignedReviewer,
        assignedAdmin: appeal.assignedAdmin,
      },
    });
  } catch (error) {
    console.error("Remove deadline error:", error);
    res.status(500).json({ message: "Server error while removing deadline" });
  }
});

router.get("/appeals/deadlines", async (req, res) => {
  try {
    const { days = 7, status, department } = req.query;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    let query = {
      deadline: { $exists: true, $ne: null },
      deadline: { $gte: now, $lte: futureDate },
    };

    if (status) query.status = status;
    if (department) {
      const students = await User.find({ role: "student", department });
      const studentIds = students.map((student) => student._id);
      query.student = { $in: studentIds };
    }

    const appeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId department")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const groupedAppeals = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      upcoming: [],
    };

    appeals.forEach((appeal) => {
      const deadlineDate = new Date(appeal.deadline);
      deadlineDate.setHours(0, 0, 0, 0);

      if (deadlineDate < today) {
        groupedAppeals.overdue.push(appeal);
      } else if (deadlineDate.getTime() === today.getTime()) {
        groupedAppeals.today.push(appeal);
      } else if (deadlineDate.getTime() === tomorrow.getTime()) {
        groupedAppeals.tomorrow.push(appeal);
      } else if (deadlineDate <= nextWeek) {
        groupedAppeals.thisWeek.push(appeal);
      } else {
        groupedAppeals.upcoming.push(appeal);
      }
    });

    res.json({
      days: parseInt(days),
      total: appeals.length,
      grouped: groupedAppeals,
      summary: {
        overdue: groupedAppeals.overdue.length,
        today: groupedAppeals.today.length,
        tomorrow: groupedAppeals.tomorrow.length,
        thisWeek: groupedAppeals.thisWeek.length,
        upcoming: groupedAppeals.upcoming.length,
      },
    });
  } catch (error) {
    console.error("Get deadlines error:", error);
    res.status(500).json({ message: "Server error while fetching deadlines" });
  }
});

router.put("/appeals/bulk-deadlines", async (req, res) => {
  try {
    const { appealIds, deadline, reason } = req.body;

    if (!appealIds || !Array.isArray(appealIds) || appealIds.length === 0) {
      return res.status(400).json({ message: "Appeal IDs array is required" });
    }

    if (!deadline) {
      return res.status(400).json({ message: "Deadline is required" });
    }

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ message: "Invalid deadline format" });
    }

    if (deadlineDate <= new Date()) {
      return res
        .status(400)
        .json({ message: "Deadline must be in the future" });
    }

    const updatePromises = appealIds.map(async (appealId) => {
      const appeal = await Appeal.findById(appealId);
      if (!appeal) return null;

      appeal.deadline = deadlineDate;

      appeal.timeline.push({
        action: "deadline_set_bulk",
        description: `Deadline set to ${deadlineDate.toLocaleDateString()} via bulk operation${
          reason ? ` - Reason: ${reason}` : ""
        }`,
        performedBy: req.user._id,
        timestamp: new Date(),
      });

      if (reason) {
        appeal.notes.push({
          content: `Deadline set via bulk operation: ${deadlineDate.toLocaleDateString()}. Reason: ${reason}`,
          author: req.user._id,
          timestamp: new Date(),
          isInternal: true,
        });
      }

      return appeal.save();
    });

    const results = await Promise.all(updatePromises);
    const successfulUpdates = results.filter((result) => result !== null);
    const failedUpdates = appealIds.length - successfulUpdates.length;

    res.json({
      message: `Deadlines set for ${successfulUpdates.length} appeals`,
      total: appealIds.length,
      successful: successfulUpdates.length,
      failed: failedUpdates,
      deadline: deadlineDate,
      reason: reason || null,
    });
  } catch (error) {
    console.error("Bulk deadlines error:", error);
    res
      .status(500)
      .json({ message: "Server error while setting bulk deadlines" });
  }
});

module.exports = router;
