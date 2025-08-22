const express = require("express");
const { body, validationResult } = require("express-validator");
const Appeal = require("../models/Appeal");
const { auth, requireReviewer } = require("../middleware/auth");
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

// All routes require reviewer role
router.use(auth, requireReviewer);

// @route   GET /api/reviewer/appeals
// @desc    Get appeals assigned to reviewer or unassigned appeals
// @access  Private (Reviewer)
router.get("/appeals", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, appealType } = req.query;
    let query = {
      assignedReviewer: req.user._id,
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

// @route   GET /api/reviewer/appeals/:id/evidence/:filename/download
// @desc    Download evidence file for a specific appeal (reviewer access)
// @access  Private (Reviewer - assigned appeals only)
router.get("/appeals/:id/evidence/:filename/download", async (req, res) => {
  try {
    const { id, filename } = req.params;

    console.log("Reviewer download request:", { id, filename });

    // Find the appeal
    const appeal = await Appeal.findById(id);

    if (!appeal) {
      console.log("Appeal not found for reviewer:", id);
      return res.status(404).json({ message: "Appeal not found" });
    }

    // Check if reviewer is assigned to this appeal
    if (
      !appeal.assignedReviewer ||
      appeal.assignedReviewer.toString() !== req.user._id.toString()
    ) {
      console.log("Reviewer not authorized for appeal:", id);
      return res
        .status(403)
        .json({ message: "You are not assigned to review this appeal" });
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
      console.log("File not found on server:", filePath);
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
    console.error("Reviewer download evidence error:", error);
    res.status(500).json({ message: "Server error while downloading file" });
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

    // Check if reviewer is assigned to this appeal
    if (
      !appeal.assignedReviewer ||
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
        !appeal.assignedReviewer ||
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
      .withMessage("Invalid decision outcome"),
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
        !appeal.assignedReviewer ||
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

      await appeal.populate("student", "firstName lastName email studentId");

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

// @route   POST /api/reviewer/appeals/:id/evidence
// @desc    Upload additional evidence files for an appeal (reviewer access)
// @access  Private (Reviewer - assigned appeals only)
router.post(
  "/appeals/:id/evidence",
  upload.array("evidence", 10),
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log("Reviewer evidence upload request:", { id });
      console.log("Files received:", req.files);

      // Find the appeal
      const appeal = await Appeal.findById(id);

      if (!appeal) {
        console.log("Appeal not found for reviewer:", id);
        return res.status(404).json({ message: "Appeal not found" });
      }

      // Check if reviewer is assigned to this appeal
      if (
        !appeal.assignedReviewer ||
        appeal.assignedReviewer.toString() !== req.user._id.toString()
      ) {
        console.log("Reviewer not authorized for appeal:", id);
        return res
          .status(403)
          .json({ message: "You are not assigned to review this appeal" });
      }

      // Process uploaded files
      let processedEvidence = [];
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
            uploadedBy: req.user._id,
            uploadedByRole: "reviewer",
          };
        });
        console.log("Processed evidence files:", processedEvidence);
      } else {
        console.log("No files uploaded");
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Add new evidence to the appeal
      appeal.evidence.push(...processedEvidence);

      // Add to timeline
      appeal.timeline.push({
        action: "Additional evidence uploaded",
        description: `Reviewer uploaded ${processedEvidence.length} additional evidence file(s)`,
        performedBy: req.user._id,
      });

      await appeal.save();

      console.log("Evidence uploaded successfully:", processedEvidence);

      res.json({
        message: "Evidence uploaded successfully",
        evidence: processedEvidence,
      });
    } catch (error) {
      console.error("Reviewer evidence upload error:", error);
      res
        .status(500)
        .json({ message: "Server error while uploading evidence" });
    }
  }
);

// @route   GET /api/reviewer/appeals/dashboard
// @desc    Get reviewer appeal statistics for dashboard
// @access  Private (Reviewer)
router.get("/appeals/dashboard", async (req, res) => {
  try {
    const query = {
      assignedReviewer: req.user._id,
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
      assignedReviewer: req.user._id,
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

module.exports = router;
