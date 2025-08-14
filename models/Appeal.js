const mongoose = require("mongoose");

const appealSchema = new mongoose.Schema(
  {
    appealId: {
      type: String,
      required: true,
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

// Generate appeal ID before saving
appealSchema.pre("save", function (next) {
  if (!this.appealId) {
    const year = new Date().getFullYear();
    const count = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    this.appealId = `APL-${year}-${count}`;
  }
  next();
});

// Index for better query performance
appealSchema.index({ student: 1, status: 1 });
appealSchema.index({ status: 1, priority: 1 });
appealSchema.index({ appealId: 1 });
appealSchema.index({ appealType: 1 });
appealSchema.index({ submittedDate: 1 });

module.exports = mongoose.model("Appeal", appealSchema);
