// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const raw = req.header("Authorization") || "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;

    if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Accept various JWT payload shapes: { userId }, { id }, { _id }
    const userId = decoded.userId || decoded.id || decoded._id;
    if (!userId) return res.status(401).json({ message: "Invalid token payload." });

    // Ensure we load fields the routes rely on
    const user = await User.findById(userId).select("_id role isActive firstName lastName email studentId");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid token or user not found." });
    }

    req.user = user; // now has _id, role, studentId
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") return res.status(401).json({ message: "Invalid token." });
    if (error.name === "TokenExpiredError") return res.status(401).json({ message: "Token expired." });
    res.status(500).json({ message: "Server error." });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required." });
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  next();
};

const requireStudent = requireRole(["student"]);
const requireAdmin = requireRole(["admin"]);
const requireReviewer = requireRole(["reviewer"]);
const requireAdminOrReviewer = requireRole(["admin", "reviewer"]);

module.exports = { auth, requireRole, requireStudent, requireAdmin, requireReviewer, requireAdminOrReviewer };
