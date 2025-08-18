const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");
const nano = customAlphabet("0123456789", 6); // Generate 6-digit numbers
const appealSchema = new mongoose.Schema(
  {
    appealId: {
      type: String,
      required: false, // Will be generated in pre-save hook
      unique: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Declaration & Deadline
    declaration: {
      type: Boolean,
      required: true,
      default: false,
    },
    deadlineCheck: {
      type: Boolean,
      required: true,
      default: false,
    },

    // Personal Information
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },

    // Adviser Information
    hasAdviser: {
      type: Boolean,
      default: false,
    },
    adviserName: {
      type: String,
      trim: true,
    },
    adviserEmail: {
      type: String,
      trim: true,
    },
    adviserPhone: {
      type: String,
      trim: true,
    },

    // Appeal Details
    appealType: {
      type: String,
      required: true,
      enum: [
        "Academic Judgment",
        "Procedural Irregularity",
        "Extenuating Circumstances",
        "Assessment Irregularity",
        "Other",
      ],
    },
    grounds: [
      {
        type: String,
        enum: [
          "Illness or medical condition",
          "Bereavement",
          "Personal circumstances",
          "Technical issues during assessment",
          "Inadequate supervision",
          "Unclear assessment criteria",
          "Other",
        ],
      },
    ],
    statement: {
      type: String,
      required: true,
    },

    // Academic Context
    moduleCode: {
      type: String,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    semester: {
      type: String,
      enum: ["1", "2", "summer", "full year"],
    },

    // Status and Priority
    status: {
      type: String,
      enum: [
        "submitted",
        "under review",
        "awaiting information",
        "decision made",
        "resolved",
        "rejected",
      ],
      default: "submitted",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Assignment
    assignedReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Documents and Evidence
    evidence: [
      {
        filename: String,
        originalName: String,
        path: String,
        fileSize: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timeline and Notes
    timeline: [
      {
        action: String,
        description: String,
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    notes: [
      {
        content: String,
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        isInternal: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Decision
    decision: {
      outcome: {
        type: String,
        enum: ["upheld", "partially upheld", "rejected", "withdrawn"],
      },
      reason: String,
      decisionDate: Date,
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    // Confirmation
    confirmAll: {
      type: Boolean,
      required: true,
      default: false,
    },

    // Timestamps
    submittedDate: {
      type: Date,
      default: Date.now,
    },
    deadline: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

appealSchema.pre("save", async function (next) {
  // Only generate appealId if it doesn't exist
  if (this.appealId) return next();

  try {
    console.log("Generating appeal ID...");
    const year = new Date().getFullYear();

    // Try to generate a unique appeal ID
    for (let i = 0; i < 5; i++) {
      const n = nano(); // e.g., "493027"
      const candidate = `APL-${year}-${n}`;
      console.log(`Trying appeal ID: ${candidate}`);

      const exists = await this.constructor.exists({ appealId: candidate });
      if (!exists) {
        this.appealId = candidate;
        console.log(`Generated appeal ID: ${this.appealId}`);
        return next();
      }
    }

    // Fallback: use timestamp-based ID
    const timestamp = Date.now().toString().slice(-6);
    this.appealId = `APL-${year}-${timestamp}`;
    console.log(`Fallback appeal ID: ${this.appealId}`);

    // Ensure appealId is set before proceeding
    if (!this.appealId) {
      throw new Error("Failed to generate appeal ID");
    }

    next();
  } catch (err) {
    console.error("Error in appeal pre-save hook:", err);
    // Don't proceed if we can't generate an appeal ID
    next(new Error(`Failed to generate appeal ID: ${err.message}`));
  }
});

// Post-save validation to ensure appealId was generated
appealSchema.post("save", function (doc) {
  if (!doc.appealId) {
    console.error("Warning: Appeal saved without appealId:", doc._id);
  }
});

// Index for better query performance
appealSchema.index({ student: 1, status: 1 });
appealSchema.index({ status: 1, priority: 1 });
appealSchema.index({ appealType: 1 });
appealSchema.index({ submittedDate: 1 });

module.exports = mongoose.model("Appeal", appealSchema);
