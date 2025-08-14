// Test script for the new comprehensive appeal creation and route structure
const axios = require("axios");

const API_BASE = "http://localhost:5000/api";

// Test data for comprehensive appeal
const testAppealData = {
  // Declaration & Deadline
  declaration: true,
  deadlineCheck: true,

  // Personal Information
  firstName: "John",
  lastName: "Doe",
  studentId: "12345678",
  email: "john.doe@student.sheffield.ac.uk",
  phone: "+44 123 456 7890",

  // Adviser Information
  hasAdviser: true,
  adviserName: "Dr. Jane Smith",
  adviserEmail: "jane.smith@sheffield.ac.uk",
  adviserPhone: "+44 123 456 7891",

  // Appeal Details
  appealType: "Extenuating Circumstances",
  grounds: ["Illness or medical condition", "Personal circumstances"],
  statement:
    "I was unable to complete my final assessment due to severe illness during the examination period. I have medical documentation supporting this claim and believe this significantly impacted my academic performance.",

  // Academic Context
  moduleCode: "COM1001",
  academicYear: "2024-25",
  semester: "1",

  // Confirmation
  confirmAll: true,
};

async function testAppealCreation() {
  try {
    console.log("🚀 Testing Comprehensive Appeal Creation...\n");

    // Step 1: Register a test student
    console.log("1. Registering test student...");
    const studentResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: "john.doe@student.sheffield.ac.uk",
      password: "password123",
      firstName: "John",
      lastName: "Doe",
      role: "student",
      studentId: "12345678",
    });

    const studentToken = studentResponse.data.token;
    console.log("✅ Student registered successfully\n");

    // Step 2: Create comprehensive appeal
    console.log("2. Creating comprehensive appeal...");
    const appealResponse = await axios.post(
      `${API_BASE}/appeals`,
      testAppealData,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Appeal created successfully!");
    console.log("Appeal ID:", appealResponse.data.appeal.appealId);
    console.log("Status:", appealResponse.data.appeal.status);
    console.log("Type:", appealResponse.data.appeal.appealType);
    console.log("Grounds:", appealResponse.data.appeal.grounds.join(", "));
    console.log("\n");

    // Step 3: Get student's appeals
    console.log("3. Fetching student appeals...");
    const appealsResponse = await axios.get(`${API_BASE}/appeals`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    console.log("✅ Appeals fetched successfully!");
    console.log("Total appeals:", appealsResponse.data.appeals.length);
    console.log("\n");

    // Step 4: Get student dashboard data
    console.log("4. Fetching student dashboard data...");
    const dashboardResponse = await axios.get(`${API_BASE}/appeals/dashboard`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    console.log("✅ Dashboard data fetched successfully!");
    console.log("Status summary:", dashboardResponse.data.statusSummary);
    console.log("Total appeals:", dashboardResponse.data.total);
    console.log("\n");

    console.log("🎉 All student tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

async function testAdminOperations() {
  try {
    console.log("🏛️ Testing Admin Operations...\n");

    // Step 1: Register a test admin
    console.log("1. Registering test admin...");
    const adminResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: "admin@sheffield.ac.uk",
      password: "admin123",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      department: "Computer Science",
    });

    const adminToken = adminResponse.data.token;
    console.log("✅ Admin registered successfully\n");

    // Step 2: Get all appeals (admin view)
    console.log("2. Getting all appeals (admin view)...");
    const appealsResponse = await axios.get(`${API_BASE}/admin/appeals`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    console.log("✅ Admin appeals fetched successfully!");
    console.log("Total appeals:", appealsResponse.data.appeals.length);
    console.log("\n");

    // Step 3: Get admin dashboard
    console.log("3. Getting admin dashboard...");
    const dashboardResponse = await axios.get(
      `${API_BASE}/admin/appeals/dashboard`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    console.log("✅ Admin dashboard fetched successfully!");
    console.log("Status summary:", dashboardResponse.data.statusSummary);
    console.log("Total appeals:", dashboardResponse.data.total);
    console.log("\n");

    // Step 4: Get system statistics
    console.log("4. Getting system statistics...");
    const statsResponse = await axios.get(`${API_BASE}/admin/users/stats`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    console.log("✅ System statistics fetched successfully!");
    console.log("User stats:", statsResponse.data.users);
    console.log("Appeal stats:", statsResponse.data.appeals);
    console.log("\n");

    console.log("🎉 All admin tests completed successfully!");
  } catch (error) {
    console.error(
      "❌ Admin test failed:",
      error.response?.data || error.message
    );
  }
}

async function testReviewerOperations() {
  try {
    console.log("🔍 Testing Reviewer Operations...\n");

    // Step 1: Register a test reviewer
    console.log("1. Registering test reviewer...");
    const reviewerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: "reviewer@sheffield.ac.uk",
      password: "reviewer123",
      firstName: "Reviewer",
      lastName: "User",
      role: "reviewer",
    });

    const reviewerToken = reviewerResponse.data.token;
    console.log("✅ Reviewer registered successfully\n");

    // Step 2: Get assigned appeals
    console.log("2. Getting assigned appeals...");
    const appealsResponse = await axios.get(`${API_BASE}/reviewer/appeals`, {
      headers: {
        Authorization: `Bearer ${reviewerToken}`,
      },
    });

    console.log("✅ Reviewer appeals fetched successfully!");
    console.log("Total appeals:", appealsResponse.data.appeals.length);
    console.log("\n");

    // Step 3: Get reviewer dashboard
    console.log("3. Getting reviewer dashboard...");
    const dashboardResponse = await axios.get(
      `${API_BASE}/reviewer/appeals/dashboard`,
      {
        headers: {
          Authorization: `Bearer ${reviewerToken}`,
        },
      }
    );

    console.log("✅ Reviewer dashboard fetched successfully!");
    console.log("Status summary:", dashboardResponse.data.statusSummary);
    console.log("Total appeals:", dashboardResponse.data.total);
    console.log("\n");

    console.log("🎉 All reviewer tests completed successfully!");
  } catch (error) {
    console.error(
      "❌ Reviewer test failed:",
      error.response?.data || error.message
    );
  }
}

async function runAllTests() {
  console.log("📋 Test Appeal System - New Route Structure");
  console.log("Make sure your server is running on http://localhost:5000\n");

  await testAppealCreation();
  console.log("\n" + "=".repeat(50) + "\n");

  await testAdminOperations();
  console.log("\n" + "=".repeat(50) + "\n");

  await testReviewerOperations();

  console.log("\n🎉 All tests completed!");
}

// Run the test if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testAppealCreation,
  testAdminOperations,
  testReviewerOperations,
  testAppealData,
};
