const mongoose = require("mongoose");
const Appeal = require("./models/Appeal");
const User = require("./models/User");

const testAppealData = {
  declaration: true,
  deadlineCheck: true,
  firstName: "Test",
  lastName: "User",
  studentId: "1234567",
  email: "test@example.com",
  phone: "1234567890",
  hasAdviser: true,
  adviserName: "Dr. Test",
  adviserEmail: "adviser@example.com",
  adviserPhone: "+1234567890",
  appealType: "Extenuating Circumstances",
  grounds: ["Illness or medical condition"],
  statement: "Test appeal statement",
  moduleCode: "TEST101",
  academicYear: "2025",
  semester: "1",
  confirmAll: true,
};

async function testAppealCreation() {
  try {
    await mongoose.connect("mongodb://localhost:27017/appeal_system");
    console.log("Connected to MongoDB");

    const testUser = new User({
      email: "test@example.com",
      password: "password123",
      firstName: "Test",
      lastName: "User",
      role: "student",
      studentId: "1234567",
    });

    await testUser.save();
    console.log("Test user created:", testUser._id);

    const appeal = new Appeal({
      ...testAppealData,
      student: testUser._id,
    });

    console.log("About to save appeal...");
    console.log("Appeal data:", appeal);

    await appeal.save();

    console.log("✅ Appeal created successfully!");
    console.log("Appeal ID:", appeal._id);
    console.log("Appeal Appeal ID:", appeal.appealId);
    console.log("Full appeal:", JSON.stringify(appeal, null, 2));

    await Appeal.findByIdAndDelete(appeal._id);
    await User.findByIdAndDelete(testUser._id);
    console.log("Test data cleaned up");
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

testAppealCreation();
