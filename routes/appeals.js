const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const { auth, requireStudent } = require("../middleware/auth");
const path = require("path");
const fs = require("fs-extra");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "..", "uploads");
    // Ensure uploads directory exists
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common file types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, Word docs, and text files are allowed."
        )
      );
    }
  },
});

const router = express.Router();

// @route   POST /api/appeals
// @desc    Create a new appeal (students only)
// @access  Private (Student)
router.post(
  "/",
  [
    auth,
    requireStudent,
    upload.array("evidence", 10), // Allow up to 10 files
    // Declaration & Deadline
    body("declaration")
      .custom((value) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        throw new Error("Declaration must be accepted");
      })
      .withMessage("Declaration must be accepted"),
    body("deadlineCheck")
      .custom((value) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        throw new Error("Deadline check must be confirmed");
      })
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
    body("hasAdviser")
      .optional()
      .custom((value) => {
        if (value === undefined || value === null) return true;
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return true; // Allow false values
        throw new Error("hasAdviser must be a boolean");
      }),
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
    // Grounds validation removed - no validation required
    body("statement")
      .trim()
      .notEmpty()
      .withMessage("Appeal statement is required"),

    // Evidence (optional) - handled by multer
    // grounds validation removed - will be handled in route logic

    // Academic Context
    body("moduleCode").optional().trim(),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("semester").optional().isIn(["1", "2", "summer", "full year"]),

    // Confirmation
    body("confirmAll")
      .custom((value) => {
        if (value === "true" || value === true) return true;
        if (value === "false" || value === false) return false;
        throw new Error("Final confirmation must be accepted");
      })
      .withMessage("Final confirmation must be accepted"),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Debug: Log the entire request
      console.log("=== REQUEST DEBUG ===");
      console.log("req.body:", req.body);
      console.log("req.files:", req.files);
      console.log("req.headers:", req.headers);
      console.log("Content-Type:", req.headers["content-type"]);
      console.log("=====================");

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
        grounds: rawGrounds,
        statement,
        evidence,
        moduleCode,
        academicYear,
        semester,
        confirmAll,
      } = req.body;

      // Handle grounds from FormData (might be array or individual fields)
      let grounds = rawGrounds;
      if (Array.isArray(rawGrounds)) {
        grounds = rawGrounds;
      } else if (typeof rawGrounds === "string") {
        // Try to parse as JSON, or treat as single ground
        try {
          grounds = JSON.parse(rawGrounds);
        } catch (e) {
          grounds = [rawGrounds];
        }
      } else {
        grounds = [];
      }

      // No validation required for grounds - just ensure it's an array
      if (!Array.isArray(grounds)) {
        grounds = [];
      }

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
      console.log("Raw grounds received:", rawGrounds);
      console.log("Processed grounds:", grounds);
      console.log("Evidence data received:", evidence);
      console.log("Evidence type:", typeof evidence);
      console.log("Evidence length:", evidence ? evidence.length : "undefined");
      console.log("Evidence isArray:", Array.isArray(evidence));
      console.log("Evidence === null:", evidence === null);
      console.log("Evidence === undefined:", evidence === undefined);
      console.log("Files received:", req.files);
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
        evidence: "Will be processed from uploaded files",
        moduleCode,
        academicYear,
        semester,
        confirmAll,
      });

      console.log("User object:", req.user);
      console.log("User ID type:", typeof req.user._id);
      console.log("User ID value:", req.user._id);

      // Process uploaded files
      let processedEvidence = [];
      console.log("req.files:", req.files);
      console.log("req.files type:", typeof req.files);
      console.log("req.files isArray:", Array.isArray(req.files));
      console.log(
        "req.files length:",
        req.files ? req.files.length : "undefined"
      );

      if (req.files && req.files.length > 0) {
        console.log("Processing uploaded files...");
        processedEvidence = req.files.map((file) => {
          console.log("Processing file:", file);
          return {
            filename: file.filename, // This is the unique filename stored on disk
            originalName: file.originalname, // This is the original filename
            path: file.path, // This is the full path to the file
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
          };
        });
        console.log("Processed evidence files:", processedEvidence);
      } else {
        console.log("No files uploaded or req.files is empty");
      }

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
        evidence: processedEvidence, // Use the processed uploaded files
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

// @route   GET /api/appeals/:id/evidence/:filename/download
// @desc    Download evidence file for a specific appeal
// @access  Private (Student - own appeal only)
router.get(
  "/:id/evidence/:filename/download",
  auth,
  requireStudent,
  async (req, res) => {
    try {
      const { id, filename } = req.params;

      console.log("Download request:", { id, filename });
      console.log("Request params:", req.params);

      // Find the appeal and ensure the student owns it
      const appeal = await Appeal.findOne({
        _id: id,
        student: req.user._id,
      });

      if (!appeal) {
        console.log("Appeal not found for user:", req.user._id);
        return res.status(404).json({ message: "Appeal not found" });
      }

      console.log("Appeal found:", appeal._id);
      console.log("Appeal evidence:", appeal.evidence);

      // Find the evidence file
      const evidenceFile = appeal.evidence.find(
        (file) => file.filename === filename || file.originalName === filename
      );

      console.log("Evidence file found:", evidenceFile);

      if (!evidenceFile) {
        console.log("Evidence file not found for filename:", filename);
        return res.status(404).json({ message: "Evidence file not found" });
      }

      // Construct the file path
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        evidenceFile.filename
      );

      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({ message: "File not found on server" });
      }

      // Set response headers for file download
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

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Download evidence error:", error);
      res.status(500).json({ message: "Server error while downloading file" });
    }
  }
);

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

    // Filter out internal notes for students
    if (appeal && appeal.notes) {
      appeal.notes = appeal.notes.filter((note) => !note.isInternal);
    }

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
