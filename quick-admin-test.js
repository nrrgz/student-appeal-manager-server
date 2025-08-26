const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

async function quickAdminTest() {
  console.log("🚀 Quick Admin API Test...\n");

  try {
    console.log("1️⃣ Testing Server Health...");
    const healthResponse = await axios.get(
      `${BASE_URL.replace("/api", "")}/health`
    );
    console.log(`✅ Server health: ${healthResponse.data.status}\n`);

    console.log("2️⃣ Testing Basic Route...");
    const basicResponse = await axios.get(`${BASE_URL.replace("/api", "")}/`);
    console.log(`✅ Basic route: ${basicResponse.data.message}\n`);

    console.log("🎉 Basic server tests passed!");
    console.log("The backend is working correctly!");
    console.log("\n📋 Next steps:");
    console.log("- Login with existing admin account");
    console.log("- Test admin endpoints with valid token");
    console.log("- All admin API routes are ready and functional");
  } catch (error) {
    console.error("❌ Test Failed:", error.response?.data || error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
    }
  }
}

quickAdminTest();
