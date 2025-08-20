const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/appeal_system"
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Routes
console.log("Loading routes...");
try {
  app.use("/api/auth", require("./routes/auth"));
  console.log("Auth routes loaded");
} catch (error) {
  console.error("Failed to load auth routes:", error.message);
}

try {
  app.use("/api/appeals", require("./routes/appeals"));
  console.log("Appeals routes loaded");
} catch (error) {
  console.error("Failed to load appeals routes:", error.message);
}

try {
  app.use("/api/admin", require("./routes/admin"));
  console.log("Admin routes loaded");
} catch (error) {
  console.error("Failed to load admin routes:", error.message);
}

try {
  app.use("/api/reviewer", require("./routes/reviewer"));
  console.log("Reviewer routes loaded");
} catch (error) {
  console.error("Failed to load reviewer routes:", error.message);
}

try {
  app.use("/api/users", require("./routes/users"));
  console.log("Users routes loaded");
} catch (error) {
  console.error("Failed to load users routes:", error.message);
}

console.log("All routes loaded successfully");

// Basic route for testing
app.get("/", (req, res) => {
  res.json({ message: "Student Appeal Manager API is running!" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
