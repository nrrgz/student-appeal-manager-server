const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");
const nano = customAlphabet("0123456789", 6);
const appealSchema = new mongoose.Schema(
  {
    appealId: {
      type: String,
      required: false,
      unique: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

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
    course: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },

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

    assignedReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

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

    confirmAll: {
      type: Boolean,
      required: true,
      default: false,
    },

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
  if (this.appealId) return next();

  try {
    console.log("Generating appeal ID...");
    const year = new Date().getFullYear();

    for (let i = 0; i < 5; i++) {
      const n = nano();
      const candidate = `APL-${year}-${n}`;
      console.log(`Trying appeal ID: ${candidate}`);

      const exists = await this.constructor.exists({ appealId: candidate });
      if (!exists) {
        this.appealId = candidate;
        console.log(`Generated appeal ID: ${this.appealId}`);
        return next();
      }
    }

    const timestamp = Date.now().toString().slice(-6);
    this.appealId = `APL-${year}-${timestamp}`;
    console.log(`Fallback appeal ID: ${this.appealId}`);

    if (!this.appealId) {
      throw new Error("Failed to generate appeal ID");
    }

    next();
  } catch (err) {
    console.error("Error in appeal pre-save hook:", err);
    next(new Error(`Failed to generate appeal ID: ${err.message}`));
  }
});

appealSchema.post("save", function (doc) {
  if (!doc.appealId) {
    console.error("Warning: Appeal saved without appealId:", doc._id);
  }
});

appealSchema.index({ student: 1, status: 1 });
appealSchema.index({ status: 1, priority: 1 });
appealSchema.index({ appealType: 1 });
appealSchema.index({ submittedDate: 1 });

module.exports = mongoose.model("Appeal", appealSchema);
