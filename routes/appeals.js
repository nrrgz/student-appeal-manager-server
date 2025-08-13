const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const User = require("../models/User");
const {
  auth,
  requireStudent,
  requireAdminOrReviewer,
} = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/appeals
// @desc    Create a new appeal (students only)
// @access  Private (Student)
router.post(
  "/",
  [
    auth,
    requireStudent,
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("grounds").isIn([
      "extenuating circumstances",
      "procedural irregularity",
      "academic judgment",
      "other",
    ]),
    body("moduleCode").optional().trim(),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("semester").optional().isIn(["1", "2", "summer", "full year"]),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        grounds,
        moduleCode,
        academicYear,
        semester,
      } = req.body;

      // Create new appeal
      const appeal = new Appeal({
        student: req.user._id,
        title,
        description,
        grounds,
        moduleCode,
        academicYear,
        semester,
      });

      await appeal.save();

      // Add to timeline
      appeal.timeline.push({
        action: "Appeal submitted",
        description: "Appeal created and submitted for review",
        performedBy: req.user._id,
      });

      await appeal.save();

      // Populate student info for response
      await appeal.populate("student", "firstName lastName email studentId");

      res.status(201).json({
        message: "Appeal submitted successfully",
        appeal,
      });
    } catch (error) {
      console.error("Appeal creation error:", error);
      res.status(500).json({ message: "Server error during appeal creation" });
    }
  }
);

// @route   GET /api/appeals
// @desc    Get appeals based on user role
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    let appeals;
    let query = {};

    switch (req.user.role) {
      case "student":
        // Students can only see their own appeals
        query.student = req.user._id;
        break;
      case "admin":
        // Admins can see all appeals
        break;
      case "reviewer":
        // Reviewers can see appeals assigned to them or unassigned appeals
        query.$or = [
          { assignedReviewer: req.user._id },
          { assignedReviewer: { $exists: false } },
        ];
        break;
    }

    appeals = await Appeal.find(query)
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json({ appeals });
  } catch (error) {
    console.error("Get appeals error:", error);
    res.status(500).json({ message: "Server error while fetching appeals" });
  }
});

// @route   GET /api/appeals/:id
// @desc    Get specific appeal by ID
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const appeal = await Appeal.findById(req.params.id)
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .populate("timeline.performedBy", "firstName lastName role")
      .populate("notes.author", "firstName lastName role");

    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    // Check access permissions
    if (
      req.user.role === "student" &&
      appeal.student.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ appeal });
  } catch (error) {
    console.error("Get appeal error:", error);
    res.status(500).json({ message: "Server error while fetching appeal" });
  }
});

// @route   PUT /api/appeals/:id
// @desc    Update appeal (admin/reviewer only)
// @access  Private (Admin/Reviewer)
router.put(
  "/:id",
  [
    auth,
    requireAdminOrReviewer,
    body("status")
      .optional()
      .isIn([
        "submitted",
        "under review",
        "awaiting information",
        "decision made",
        "resolved",
        "rejected",
      ]),
    body("priority").optional().isIn(["low", "medium", "high", "urgent"]),
    body("assignedReviewer").optional().isMongoId(),
    body("assignedAdmin").optional().isMongoId(),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const appeal = await Appeal.findById(req.params.id);
      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }

      const { status, priority, assignedReviewer, assignedAdmin } = req.body;
      const updates = {};

      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (assignedReviewer) updates.assignedReviewer = assignedReviewer;
      if (assignedAdmin) updates.assignedAdmin = assignedAdmin;

      // Add to timeline
      const timelineEntry = {
        action: "Appeal updated",
        description: `Updated by ${req.user.role}: ${req.user.firstName} ${req.user.lastName}`,
        performedBy: req.user._id,
      };

      if (status) {
        timelineEntry.description += ` - Status changed to: ${status}`;
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
        message: "Appeal updated successfully",
        appeal: updatedAppeal,
      });
    } catch (error) {
      console.error("Appeal update error:", error);
      res.status(500).json({ message: "Server error during appeal update" });
    }
  }
);

// @route   POST /api/appeals/:id/notes
// @desc    Add note to appeal
// @access  Private
router.post(
  "/:id/notes",
  [
    auth,
    body("content").trim().notEmpty().withMessage("Note content is required"),
    body("isInternal").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const appeal = await Appeal.findById(req.params.id);
      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }

      // Check access permissions
      if (
        req.user.role === "student" &&
        appeal.student.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { content, isInternal = false } = req.body;

      // Students can only add public notes
      if (req.user.role === "student" && isInternal) {
        return res
          .status(403)
          .json({ message: "Students cannot add internal notes" });
      }

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
        description: `Note added by ${req.user.role}: ${req.user.firstName} ${req.user.lastName}`,
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

// @route   PUT /api/appeals/:id/decision
// @desc    Make decision on appeal (reviewer only)
// @access  Private (Reviewer)
router.put(
  "/:id/decision",
  [
    auth,
    requireAdminOrReviewer, // Changed from requireRole(['reviewer']) to requireAdminOrReviewer
    body("outcome").isIn([
      "upheld",
      "partially upheld",
      "rejected",
      "withdrawn",
    ]),
    body("reason").trim().notEmpty().withMessage("Decision reason is required"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
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

      appeal.decision = {
        outcome,
        reason,
        decisionDate: new Date(),
        decidedBy: req.user._id,
      };

      appeal.status = "decision made";

      // Add to timeline
      appeal.timeline.push({
        action: "Decision made",
        description: `Decision: ${outcome} - ${reason}`,
        performedBy: req.user._id,
      });

      await appeal.save();

      await appeal
        .populate("student", "firstName lastName email studentId")
        .populate("decision.decidedBy", "firstName lastName");

      res.json({
        message: "Decision recorded successfully",
        appeal,
      });
    } catch (error) {
      console.error("Decision error:", error);
      res
        .status(500)
        .json({ message: "Server error while recording decision" });
    }
  }
);

module.exports = router;
