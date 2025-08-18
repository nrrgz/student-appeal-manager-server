const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const { auth, requireReviewer } = require("../middleware/auth");

const router = express.Router();

// All routes require reviewer role
router.use(auth, requireReviewer);

// @route   GET /api/reviewer/appeals
// @desc    Get appeals assigned to reviewer or unassigned appeals
// @access  Private (Reviewer)
router.get("/appeals", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, appealType } = req.query;
    let query = {
      $or: [
        { assignedReviewer: req.user._id },
        { assignedReviewer: { $exists: false } },
      ],
    };

    // Apply filters
    if (status) query.status = status;
    if (appealType) query.appealType = appealType;

    const skip = (page - 1) * limit;

    const appeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId")
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

// @route   GET /api/reviewer/appeals/:id
// @desc    Get specific appeal by ID (reviewer view)
// @access  Private (Reviewer)
router.get("/appeals/:id", async (req, res) => {
  try {
    const appeal = await Appeal.findById(req.params.id)
      .populate("student", "firstName lastName email studentId")
      .populate("assignedAdmin", "firstName lastName")
      .populate("timeline.performedBy", "firstName lastName role")
      .populate("notes.author", "firstName lastName role");

    // Ensure evidence is always an array
    if (!Array.isArray(appeal.evidence)) {
      appeal.evidence = [];
    }

    console.log("Appeal after populate operations (reviewer):", {
      id: appeal._id,
      evidence: appeal.evidence,
      evidenceType: typeof appeal.evidence,
      evidenceIsArray: Array.isArray(appeal.evidence),
      evidenceLength: appeal.evidence ? appeal.evidence.length : 0,
    });

    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    console.log("Appeal retrieved from database (reviewer):", {
      id: appeal._id,
      evidence: appeal.evidence,
      evidenceType: typeof appeal.evidence,
      evidenceIsArray: Array.isArray(appeal.evidence),
      evidenceLength: appeal.evidence ? appeal.evidence.length : 0,
    });

    // Check if reviewer is assigned to this appeal or if it's unassigned
    if (
      appeal.assignedReviewer &&
      appeal.assignedReviewer.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You are not assigned to review this appeal" });
    }

    console.log("Sending appeal to reviewer:", {
      id: appeal._id,
      evidence: appeal.evidence,
      evidenceLength: appeal.evidence ? appeal.evidence.length : 0,
    });

    // Ensure evidence is always an array in response
    if (!Array.isArray(appeal.evidence)) {
      appeal.evidence = [];
    }

    console.log("Response appeal evidence (reviewer):", appeal.evidence);
    console.log(
      "Response appeal evidence type (reviewer):",
      typeof appeal.evidence
    );
    console.log(
      "Response appeal evidence isArray (reviewer):",
      Array.isArray(appeal.evidence)
    );

    res.json({ appeal });
  } catch (error) {
    console.error("Get appeal error:", error);
    res.status(500).json({ message: "Server error while fetching appeal" });
  }
});

// @route   PUT /api/reviewer/appeals/:id/status
// @desc    Update appeal status
// @access  Private (Reviewer)
router.put(
  "/appeals/:id/status",
  [
    body("status")
      .isIn([
        "under review",
        "awaiting information",
        "decision made",
        "resolved",
        "rejected",
      ])
      .withMessage("Invalid status"),
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

      // Check if reviewer is assigned to this appeal
      if (
        appeal.assignedReviewer &&
        appeal.assignedReviewer.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "You are not assigned to review this appeal" });
      }

      const { status, notes } = req.body;

      appeal.status = status;

      // Add to timeline
      appeal.timeline.push({
        action: "Status updated",
        description: `Status changed to: ${status} by reviewer: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      });

      // Add note if provided
      if (notes) {
        appeal.notes.push({
          content: notes,
          author: req.user._id,
          isInternal: true,
        });
      }

      await appeal.save();

      await appeal.populate("student", "firstName lastName email studentId");

      res.json({
        message: "Appeal status updated successfully",
        appeal,
      });
    } catch (error) {
      console.error("Update status error:", error);
      res
        .status(500)
        .json({ message: "Server error while updating appeal status" });
    }
  }
);

// @route   POST /api/reviewer/appeals/:id/notes
// @desc    Add internal note to appeal
// @access  Private (Reviewer)
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

      // Check if reviewer is assigned to this appeal
      if (
        appeal.assignedReviewer &&
        appeal.assignedReviewer.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "You are not assigned to review this appeal" });
      }

      const { content, isInternal = true } = req.body;

      const note = {
        content,
        author: req.user._id,
        isInternal,
      };

      appeal.notes.push(note);
      await appeal.save();

      // Add to timeline
      appeal.timeline.push({
        action: "Note added",
        description: `Internal note added by reviewer: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      });

      await appeal.save();

      await appeal.populate("notes.author", "firstName lastName role");

      res.json({
        message: "Note added successfully",
        note: appeal.notes[appeal.notes.length - 1],
      });
    } catch (error) {
      console.error("Add note error:", error);
      res.status(500).json({ message: "Server error while adding note" });
    }
  }
);

// @route   PUT /api/reviewer/appeals/:id/decision
// @desc    Make decision on appeal
// @access  Private (Reviewer)
router.put(
  "/appeals/:id/decision",
  [
    body("outcome")
      .isIn(["upheld", "partially upheld", "rejected", "withdrawn"])
      .withMessage("Valid outcome is required"),
    body("reason").trim().notEmpty().withMessage("Decision reason is required"),
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

      // Check if reviewer is assigned to this appeal
      if (
        appeal.assignedReviewer &&
        appeal.assignedReviewer.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "You are not assigned to review this appeal" });
      }

      const { outcome, reason } = req.body;

      // Update appeal with decision
      appeal.decision = {
        outcome,
        reason,
        decisionDate: new Date(),
        decidedBy: req.user._id,
      };

      // Update status based on decision
      if (outcome === "withdrawn") {
        appeal.status = "resolved";
      } else {
        appeal.status = "decision made";
      }

      // Add to timeline
      appeal.timeline.push({
        action: "Decision made",
        description: `Decision: ${outcome} - ${reason} by reviewer: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      });

      await appeal.save();

      await appeal.populate("student", "firstName lastName email studentId");
      await appeal.populate("assignedReviewer", "firstName lastName");
      await appeal.populate("assignedAdmin", "firstName lastName");

      res.json({
        message: "Decision made successfully",
        appeal,
      });
    } catch (error) {
      console.error("Decision error:", error);
      res.status(500).json({ message: "Server error while making decision" });
    }
  }
);

// @route   PUT /api/reviewer/appeals/:id/request-info
// @desc    Request additional information from student
// @access  Private (Reviewer)
router.put(
  "/appeals/:id/request-info",
  [
    body("requestDetails")
      .trim()
      .notEmpty()
      .withMessage("Request details are required"),
    body("deadline")
      .optional()
      .isISO8601()
      .withMessage("Valid deadline date is required"),
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

      // Check if reviewer is assigned to this appeal
      if (
        appeal.assignedReviewer &&
        appeal.assignedReviewer.toString() !== req.user._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "You are not assigned to review this appeal" });
      }

      const { requestDetails, deadline } = req.body;

      // Update appeal status
      appeal.status = "awaiting information";
      if (deadline) {
        appeal.deadline = new Date(deadline);
      }

      // Add to timeline
      appeal.timeline.push({
        action: "Information requested",
        description: `Additional information requested: ${requestDetails}${
          deadline ? ` - Deadline: ${deadline}` : ""
        } by reviewer: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      });

      await appeal.save();

      await appeal.populate("student", "firstName lastName email studentId");
      await appeal.populate("assignedReviewer", "firstName lastName");
      await appeal.populate("assignedAdmin", "firstName lastName");

      res.json({
        message: "Information request sent successfully",
        appeal,
      });
    } catch (error) {
      console.error("Request info error:", error);
      res
        .status(500)
        .json({ message: "Server error while requesting information" });
    }
  }
);

// @route   GET /api/reviewer/appeals/dashboard
// @desc    Get reviewer appeal statistics for dashboard
// @access  Private (Reviewer)
router.get("/appeals/dashboard", async (req, res) => {
  try {
    const query = {
      $or: [
        { assignedReviewer: req.user._id },
        { assignedReviewer: { $exists: false } },
      ],
    };

    // Get appeals by status
    const statusCounts = await Appeal.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get appeals by type
    const typeCounts = await Appeal.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$appealType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent appeals
    const recentAppeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId")
      .sort({ createdAt: -1 })
      .limit(5);

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

// @route   GET /api/reviewer/appeals/search
// @desc    Search appeals with filters (reviewer view)
// @access  Private (Reviewer)
router.get("/appeals/search", async (req, res) => {
  try {
    const {
      status,
      appealType,
      grounds,
      academicYear,
      semester,
      page = 1,
      limit = 10,
    } = req.query;

    let query = {
      $or: [
        { assignedReviewer: req.user._id },
        { assignedReviewer: { $exists: false } },
      ],
    };

    // Apply filters
    if (status) query.status = status;
    if (appealType) query.appealType = appealType;
    if (grounds) query.grounds = { $in: [grounds] };
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = semester;

    const skip = (page - 1) * limit;

    const appeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId")
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

// @route   GET /api/reviewer/appeals/urgent
// @desc    Get urgent appeals assigned to reviewer
// @access  Private (Reviewer)
router.get("/appeals/urgent", async (req, res) => {
  try {
    const query = {
      $or: [
        { assignedReviewer: req.user._id },
        { assignedReviewer: { $exists: false } },
      ],
      priority: { $in: ["high", "urgent"] },
      status: { $in: ["submitted", "under review"] },
    };

    const urgentAppeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ priority: -1, createdAt: 1 })
      .limit(20);

    res.json({ urgentAppeals });
  } catch (error) {
    console.error("Get urgent appeals error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching urgent appeals" });
  }
});

// @route   GET /api/reviewer/appeals/overdue
// @desc    Get overdue appeals assigned to reviewer
// @access  Private (Reviewer)
router.get("/appeals/overdue", async (req, res) => {
  try {
    const overdueCriteria = {
      $or: [
        { deadline: { $lt: new Date() } },
        {
          createdAt: {
            $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
          },
        },
      ],
    };

    const query = {
      $and: [
        {
          $or: [
            { assignedReviewer: req.user._id },
            { assignedReviewer: { $exists: false } },
          ],
        },
        { status: { $in: ["submitted", "under review"] } },
        overdueCriteria,
      ],
    };

    const overdueAppeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ deadline: 1, createdAt: 1 })
      .limit(20);

    res.json({ overdueAppeals });
  } catch (error) {
    console.error("Get overdue appeals error:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching overdue appeals" });
  }
});

module.exports = router;
