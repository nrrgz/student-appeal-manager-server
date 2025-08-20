const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";
let adminToken = "";
let testAppealId = "";
let testUserId = "";

// Test data
const testAdmin = {
  email: "admin@test.com",
  password: "password123",
  firstName: "Test",
  lastName: "Admin",
  role: "admin",
  department: "Computer Science",
};

const testAppeal = {
  declaration: true,
  deadlineCheck: true,
  firstName: "Test",
  lastName: "Student",
  studentId: "TEST123",
  email: "student@test.com",
  phone: "1234567890",
  hasAdviser: false,
  appealType: "Extenuating Circumstances",
  grounds: ["Illness or medical condition"],
  statement: "Test appeal statement",
  moduleCode: "TEST101",
  academicYear: "2024",
  semester: "1",
  confirmAll: true,
  department: "Computer Science",
};

async function testAdminAPI() {
  console.log("🚀 Starting Admin API Tests...\n");

  try {
    // 1. Register admin user
    console.log("1️⃣ Testing Admin Registration...");
    const registerResponse = await axios.post(
      `${BASE_URL}/auth/register`,
      testAdmin
    );
    console.log("✅ Admin registered successfully");
    adminToken = registerResponse.data.token;
    console.log(`Token: ${adminToken.substring(0, 20)}...\n`);

    // 2. Login admin user
    console.log("2️⃣ Testing Admin Login...");
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testAdmin.email,
      password: testAdmin.password,
    });
    console.log("✅ Admin login successful");
    adminToken = loginResponse.data.token;
    console.log(`Token: ${adminToken.substring(0, 20)}...\n`);

    // 3. Create a test appeal (as student)
    console.log("3️⃣ Creating Test Appeal...");
    const studentResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: "student@test.com",
      password: "password123",
      firstName: "Test",
      lastName: "Student",
      role: "student",
      studentId: "TEST123",
    });

    const studentToken = studentResponse.data.token;
    const appealResponse = await axios.post(`${BASE_URL}/appeals`, testAppeal, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    testAppealId = appealResponse.data.appeal._id;
    console.log(`✅ Test appeal created with ID: ${testAppealId}\n`);

    // 4. Test Get All Appeals (Admin)
    console.log("4️⃣ Testing Get All Appeals (Admin)...");
    const appealsResponse = await axios.get(`${BASE_URL}/admin/appeals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✅ Retrieved ${appealsResponse.data.appeals.length} appeals`);
    console.log(
      `Pagination: ${appealsResponse.data.pagination.current}/${appealsResponse.data.pagination.total}\n`
    );

    // 5. Test Get Appeal by ID (Admin)
    console.log("5️⃣ Testing Get Appeal by ID (Admin)...");
    const appealByIdResponse = await axios.get(
      `${BASE_URL}/admin/appeals/${testAppealId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Retrieved appeal: ${appealByIdResponse.data.appeal.appealId}\n`
    );

    // 6. Test Update Appeal Priority
    console.log("6️⃣ Testing Update Appeal Priority...");
    const priorityResponse = await axios.put(
      `${BASE_URL}/admin/appeals/${testAppealId}/priority`,
      {
        priority: "high",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Appeal priority updated to: ${priorityResponse.data.appeal.priority}\n`
    );

    // 7. Test Update Appeal Status
    console.log("7️⃣ Testing Update Appeal Status...");
    const statusResponse = await axios.put(
      `${BASE_URL}/admin/appeals/${testAppealId}/status`,
      {
        status: "under review",
        notes: "Admin status update test",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Appeal status updated to: ${statusResponse.data.appeal.status}\n`
    );

    // 8. Test Add Admin Note
    console.log("8️⃣ Testing Add Admin Note...");
    const noteResponse = await axios.post(
      `${BASE_URL}/admin/appeals/${testAppealId}/notes`,
      {
        content: "Test admin note",
        isInternal: true,
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Admin note added. Total notes: ${noteResponse.data.appeal.notes.length}\n`
    );

    // 9. Test Assign Reviewer/Admin
    console.log("9️⃣ Testing Assign Reviewer/Admin...");
    const assignResponse = await axios.put(
      `${BASE_URL}/admin/appeals/${testAppealId}/assign`,
      {
        priority: "urgent",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Appeal assigned with priority: ${assignResponse.data.appeal.priority}\n`
    );

    // 10. Test Get Admin Dashboard
    console.log("🔟 Testing Get Admin Dashboard...");
    const dashboardResponse = await axios.get(
      `${BASE_URL}/admin/appeals/dashboard`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Dashboard data retrieved. Total appeals: ${dashboardResponse.data.total}`
    );
    console.log(`Status summary:`, dashboardResponse.data.statusSummary);
    console.log("");

    // 11. Test Search Appeals
    console.log("1️⃣1️⃣ Testing Search Appeals...");
    const searchResponse = await axios.get(
      `${BASE_URL}/admin/appeals/search?status=under review`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Search completed. Found ${searchResponse.data.appeals.length} appeals with status 'under review'\n`
    );

    // 12. Test Get All Users
    console.log("1️⃣2️⃣ Testing Get All Users...");
    const usersResponse = await axios.get(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`✅ Retrieved ${usersResponse.data.users.length} users`);
    console.log(
      `Pagination: ${usersResponse.data.pagination.current}/${usersResponse.data.pagination.total}\n`
    );

    // 13. Test Get Reviewers
    console.log("1️⃣3️⃣ Testing Get Reviewers...");
    const reviewersResponse = await axios.get(
      `${BASE_URL}/admin/users/reviewers`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Retrieved ${reviewersResponse.data.reviewers.length} reviewers\n`
    );

    // 14. Test Get User Stats
    console.log("1️⃣4️⃣ Testing Get User Stats...");
    const statsResponse = await axios.get(`${BASE_URL}/admin/users/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(
      `✅ User stats retrieved. Total users: ${statsResponse.data.users.total}`
    );
    console.log(`Total appeals: ${statsResponse.data.appeals.total}\n`);

    // 15. Test Get Appeal Reports
    console.log("1️⃣5️⃣ Testing Get Appeal Reports...");
    const reportsResponse = await axios.get(
      `${BASE_URL}/admin/reports/appeals?dateRange=30`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(
      `✅ Reports retrieved for last ${reportsResponse.data.dateRange} days`
    );
    console.log(`Total appeals in range: ${reportsResponse.data.total}`);
    console.log(`Resolution stats:`, reportsResponse.data.resolutionStats);
    console.log("");

    // 16. Test Bulk Assignment
    console.log("1️⃣6️⃣ Testing Bulk Assignment...");
    const bulkResponse = await axios.post(
      `${BASE_URL}/admin/appeals/bulk-assign`,
      {
        appealIds: [testAppealId],
        priority: "medium",
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log(`✅ Bulk assignment completed: ${bulkResponse.data.message}\n`);

    console.log("🎉 All Admin API Tests Passed Successfully!");
    console.log("\n📊 Summary:");
    console.log("- ✅ Authentication & Authorization");
    console.log("- ✅ Appeal Management (CRUD)");
    console.log("- ✅ Priority & Status Updates");
    console.log("- ✅ Note Management");
    console.log("- ✅ Assignment Operations");
    console.log("- ✅ Dashboard & Statistics");
    console.log("- ✅ Search & Filtering");
    console.log("- ✅ User Management");
    console.log("- ✅ Reporting & Analytics");
    console.log("- ✅ Bulk Operations");
  } catch (error) {
    console.error("❌ Test Failed:", error.response?.data || error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
    }
  }
}

// Run the tests
testAdminAPI();
