const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("firstName").trim().notEmpty(),
    body("lastName").trim().notEmpty(),
    body("role").isIn(["student", "admin", "reviewer"]),
    body("studentId").optional().trim(),
    body("department").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        role,
        studentId,
        department,
      } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }

      if (role === "student" && studentId) {
        const existingStudent = await User.findOne({ studentId });
        if (existingStudent) {
          return res.status(400).json({ message: "Student ID already exists" });
        }
      }

      const user = new User({
        email,
        password,
        firstName,
        lastName,
        role,
        studentId: role === "student" ? studentId : undefined,
        department: role === "admin" ? department : undefined,
      });

      await user.save();

      const token = generateToken(user._id);

      user.lastLogin = new Date();
      await user.save();

      res.status(201).json({
        message: "User registered successfully",
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error during registration" });
    }
  }
);

router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, role } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(400).json({ message: "Account is deactivated" });
      }

      if (role && user.role !== role) {
        return res
          .status(400)
          .json({ message: "Invalid role for this account" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user._id);

      user.lastLogin = new Date();
      await user.save();

      res.json({
        message: "Login successful",
        token,
        user: user.toJSON(),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error during login" });
    }
  }
);

router.get("/profile", auth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/profile",
  auth,
  [
    body("firstName").optional().trim().notEmpty(),
    body("lastName").optional().trim().notEmpty(),
    body("department").optional().trim(),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { firstName, lastName, department } = req.body;
      const updates = {};

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (department && req.user.role === "admin")
        updates.department = department;

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json({
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Server error during profile update" });
    }
  }
);

router.post("/logout", auth, async (req, res) => {
  try {
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
