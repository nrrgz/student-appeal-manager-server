const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const { auth, requireStudent } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/appeals
// @desc    Create a new appeal (students only)
// @access  Private (Student)
router.post(
  "/",
  [
    auth,
    requireStudent,
    // Declaration & Deadline
    body("declaration").isBoolean().withMessage("Declaration must be accepted"),
    body("deadlineCheck")
      .isBoolean()
      .withMessage("Deadline check must be confirmed"),

    // Personal Information
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("studentId").trim().notEmpty().withMessage("Student ID is required"),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("phone").optional().trim(),
    body("department")
      .trim()
      .notEmpty()
      .withMessage("Department selection is required"),

    // Adviser Information
    body("hasAdviser").optional().isBoolean(),
    body("adviserName").optional({ checkFalsy: true }).trim(),
    body("adviserEmail")
      .optional({ checkFalsy: true })
      .isEmail()
      .normalizeEmail(),
    body("adviserPhone").optional({ checkFalsy: true }).trim(),

    // Appeal Details
    body("appealType")
      .isIn([
        "Academic Judgment",
        "Procedural Irregularity",
        "Extenuating Circumstances",
        "Assessment Irregularity",
        "Other",
      ])
      .withMessage("Valid appeal type is required"),
    body("grounds")
      .isArray({ min: 1 })
      .withMessage("At least one ground must be selected"),
    body("grounds.*")
      .isIn([
        "Illness or medical condition",
        "Bereavement",
        "Personal circumstances",
        "Technical issues during assessment",
        "Inadequate supervision",
        "Unclear assessment criteria",
        "Other",
      ])
      .withMessage("Invalid ground selected"),
    body("statement")
      .trim()
      .notEmpty()
      .withMessage("Appeal statement is required"),

    // Evidence (optional)
    body("evidence")
      .optional()
      .isArray()
      .withMessage("Evidence must be an array"),

    // Academic Context
    body("moduleCode").optional().trim(),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("semester").optional().isIn(["1", "2", "summer", "full year"]),

    // Confirmation
    body("confirmAll")
      .isBoolean()
      .withMessage("Final confirmation must be accepted"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        declaration,
        deadlineCheck,
        firstName,
        lastName,
        studentId,
        email,
        phone,
        department,
        hasAdviser,
        adviserName,
        adviserEmail,
        adviserPhone,
        appealType,
        grounds,
        statement,
        evidence,
        moduleCode,
        academicYear,
        semester,
        confirmAll,
      } = req.body;

      // Debug: Log the received data
      console.log("Received appeal data:", {
        declaration,
        deadlineCheck,
        firstName,
        lastName,
        studentId,
        email,
        phone,
        department,
        hasAdviser,
        adviserName,
        adviserEmail,
        adviserPhone,
        appealType,
        grounds,
        statement,
        evidence,
        moduleCode,
        academicYear,
        semester,
        confirmAll,
      });
      console.log("Evidence data received:", evidence);
      console.log("Evidence type:", typeof evidence);
      console.log("Evidence length:", evidence ? evidence.length : "undefined");
      console.log("Evidence isArray:", Array.isArray(evidence));
      console.log("Evidence === null:", evidence === null);
      console.log("Evidence === undefined:", evidence === undefined);
      console.log("User from auth:", req.user);

      // Verify user has accepted all required confirmations
      if (!declaration || !deadlineCheck || !confirmAll) {
        return res.status(400).json({
          message: "All required confirmations must be accepted",
        });
      }

      // Verify student ID matches the authenticated user
      if (studentId !== req.user.studentId) {
        return res.status(400).json({
          message: "Student ID must match your registered student ID",
        });
      }

      // Create new appeal
      console.log("Creating appeal with data:", {
        student: req.user._id,
        declaration,
        deadlineCheck,
        firstName,
        lastName,
        studentId,
        email,
        phone,
        hasAdviser,
        adviserName: hasAdviser ? adviserName : undefined,
        adviserEmail: hasAdviser ? adviserEmail : undefined,
        adviserPhone: hasAdviser ? adviserPhone : undefined,
        appealType,
        grounds,
        statement,
        evidence: Array.isArray(evidence) ? evidence : [],
        moduleCode,
        academicYear,
        semester,
        confirmAll,
      });
      console.log("Evidence field being set:", evidence || []);
      console.log("Evidence field type:", typeof (evidence || []));
      console.log("Evidence field isArray:", Array.isArray(evidence || []));

      console.log("User object:", req.user);
      console.log("User ID type:", typeof req.user._id);
      console.log("User ID value:", req.user._id);

      const appeal = new Appeal({
        student: req.user._id,
        declaration,
        deadlineCheck,
        firstName,
        lastName,
        studentId,
        email,
        phone,
        department,
        hasAdviser,
        adviserName: hasAdviser ? adviserName : undefined,
        adviserEmail: hasAdviser ? adviserEmail : undefined,
        adviserPhone: hasAdviser ? adviserPhone : undefined,
        appealType,
        grounds,
        statement,
        evidence: Array.isArray(evidence) ? evidence : [],
        moduleCode,
        academicYear,
        semester,
        confirmAll,
      });

      // Ensure evidence is always an array in the appeal object
      if (!Array.isArray(appeal.evidence)) {
        appeal.evidence = [];
      }

      console.log("Appeal object created with evidence:", appeal.evidence);
      console.log(
        "Evidence field type in appeal object:",
        typeof appeal.evidence
      );
      console.log(
        "Evidence field isArray in appeal object:",
        Array.isArray(appeal.evidence)
      );

      console.log("Appeal object created:", appeal);
      console.log("Evidence in appeal object:", appeal.evidence);
      console.log("About to save appeal...");
      console.log("Appeal appealId before save:", appeal.appealId);

      await appeal.save();

      console.log("Appeal saved successfully");
      console.log("Appeal appealId after save:", appeal.appealId);
      console.log("Appeal evidence after save:", appeal.evidence);
      console.log("Evidence field type after save:", typeof appeal.evidence);
      console.log(
        "Evidence field isArray after save:",
        Array.isArray(appeal.evidence)
      );
      console.log(
        "Full appeal object after save:",
        JSON.stringify(appeal, null, 2)
      );

      // Add to timeline
      appeal.timeline.push({
        action: "Appeal submitted",
        description: `Appeal created and submitted for review - Type: ${appealType}`,
        performedBy: req.user._id,
      });

      await appeal.save();

      console.log(
        "Evidence field after second save (timeline):",
        appeal.evidence
      );
      console.log(
        "Evidence field type after second save:",
        typeof appeal.evidence
      );
      console.log(
        "Evidence field isArray after second save:",
        Array.isArray(appeal.evidence)
      );

      // Populate student info for response
      await appeal.populate("student", "firstName lastName email studentId");

      console.log("Evidence field after populate:", appeal.evidence);
      console.log(
        "Evidence field type after populate:",
        typeof appeal.evidence
      );
      console.log(
        "Evidence field isArray after populate:",
        Array.isArray(appeal.evidence)
      );

      console.log("Sending response with appeal evidence:", appeal.evidence);
      console.log("Response appeal evidence type:", typeof appeal.evidence);
      console.log(
        "Response appeal evidence isArray:",
        Array.isArray(appeal.evidence)
      );

      res.status(201).json({
        message: "Appeal submitted successfully",
        appeal,
      });
    } catch (error) {
      console.error("Appeal creation error:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        message: "Server error during appeal creation",
        error: error.message,
      });
    }
  }
);

// @route   GET /api/appeals
// @desc    Get student's own appeals
// @access  Private (Student)
router.get("/", auth, requireStudent, async (req, res) => {
  try {
    const appeals = await Appeal.find({ student: req.user._id })
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
// @desc    Get specific appeal by ID (student's own appeal)
// @access  Private (Student)
router.get("/:id", auth, requireStudent, async (req, res) => {
  try {
    const appeal = await Appeal.findOne({
      _id: req.params.id,
      student: req.user._id,
    })
      .populate("student", "firstName lastName email studentId")
      .populate("assignedReviewer", "firstName lastName")
      .populate("assignedAdmin", "firstName lastName")
      .populate("timeline.performedBy", "firstName lastName role")
      .populate("notes.author", "firstName lastName role");

    // Ensure evidence is always an array
    if (!Array.isArray(appeal.evidence)) {
      appeal.evidence = [];
    }

    console.log("Appeal after populate operations:", {
      id: appeal._id,
      evidence: appeal.evidence,
      evidenceType: typeof appeal.evidence,
      evidenceIsArray: Array.isArray(appeal.evidence),
      evidenceLength: appeal.evidence ? appeal.evidence.length : 0,
    });

    if (!appeal) {
      return res.status(404).json({ message: "Appeal not found" });
    }

    console.log("Appeal retrieved from database:", {
      id: appeal._id,
      evidence: appeal.evidence,
      evidenceType: typeof appeal.evidence,
      evidenceIsArray: Array.isArray(appeal.evidence),
      evidenceLength: appeal.evidence ? appeal.evidence.length : 0,
    });

    console.log("Sending appeal to student:", {
      id: appeal._id,
      evidence: appeal.evidence,
      evidenceLength: appeal.evidence ? appeal.evidence.length : 0,
    });

    // Ensure evidence is always an array in response
    if (!Array.isArray(appeal.evidence)) {
      appeal.evidence = [];
    }

    console.log("Response appeal evidence:", appeal.evidence);
    console.log("Response appeal evidence type:", typeof appeal.evidence);
    console.log(
      "Response appeal evidence isArray:",
      Array.isArray(appeal.evidence)
    );

    res.json({ appeal });
  } catch (error) {
    console.error("Get appeal error:", error);
    res.status(500).json({ message: "Server error while fetching appeal" });
  }
});

// @route   POST /api/appeals/:id/notes
// @desc    Add note to appeal (student's own appeal)
// @access  Private (Student)
router.post(
  "/:id/notes",
  [
    auth,
    requireStudent,
    body("content").trim().notEmpty().withMessage("Note content is required"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const appeal = await Appeal.findOne({
        _id: req.params.id,
        student: req.user._id,
      });

      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }

      const { content } = req.body;

      const note = {
        content,
        author: req.user._id,
        isInternal: false, // Students can only add public notes
      };

      appeal.notes.push(note);
      await appeal.save();

      // Add to timeline
      appeal.timeline.push({
        action: "Note added",
        description: `Note added by student: ${req.user.firstName} ${req.user.lastName}`,
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

// @route   GET /api/appeals/dashboard
// @desc    Get student's appeal statistics for dashboard
// @access  Private (Student)
router.get("/dashboard", auth, requireStudent, async (req, res) => {
  try {
    const query = { student: req.user._id };

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

module.exports = router;
