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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    grounds: {
      type: String,
      required: true,
      enum: [
        "extenuating circumstances",
        "procedural irregularity",
        "academic judgment",
        "other",
      ],
    },
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
    submittedDate: {
      type: Date,
      default: Date.now,
    },
    deadline: {
      type: Date,
    },
    assignedReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    documents: [
      {
        filename: String,
        originalName: String,
        path: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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

module.exports = mongoose.model("Appeal", appealSchema);
