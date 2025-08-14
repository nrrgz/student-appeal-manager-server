# Student Appeal Manager (SAM) - API Documentation

## Overview

The Student Appeal Manager API provides a comprehensive system for managing student appeals with role-based access control. The API supports three user roles: **Student**, **Admin**, and **Reviewer**.

**Base URL:** `http://localhost:5000/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### **Route Organization:**

- **`/api/auth/*`** - Authentication & User Profile Management
- **`/api/appeals/*`** - Student Appeal Operations (Create, View Own, Add Notes)
- **`/api/admin/*`** - Admin Operations (Manage Appeals, Users, System)
- **`/api/reviewer/*`** - Reviewer Operations (Review Appeals, Make Decisions)
- **`/api/users/*`** - User Management & System Administration

---

### 🔐 Authentication

#### Register User

```http
POST /api/auth/register
```

**Request Body:**

```json
{
  "email": "student@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "student",
  "studentId": "12345678",
  "department": "Computer Science" // Required for admin role
}
```

**Response:**

```json
{
  "message": "User registered successfully",
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "email": "student@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student",
    "studentId": "12345678"
  }
}
```

#### Login User

```http
POST /api/auth/login
```

**Request Body:**

```json
{
  "email": "student@example.com",
  "password": "password123",
  "role": "student" // Optional
}
```

**Response:**

```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "email": "student@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  }
}
```

#### Get User Profile

```http
GET /api/auth/profile
```

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "user": {
    "_id": "user_id",
    "email": "student@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student",
    "studentId": "12345678"
  }
}
```

#### Update Profile

```http
PUT /api/auth/profile
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "department": "Computer Science" // Admin only
}
```

#### Logout

```http
POST /api/auth/logout
```

**Headers:** `Authorization: Bearer <token>`

---

### 📝 Appeals (Student Operations)

#### Create Appeal (Students Only)

```http
POST /api/appeals
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "declaration": true,
  "deadlineCheck": true,
  "firstName": "John",
  "lastName": "Doe",
  "studentId": "12345678",
  "email": "john.doe@student.sheffield.ac.uk",
  "phone": "+44 123 456 7890",
  "hasAdviser": true,
  "adviserName": "Dr. Jane Smith",
  "adviserEmail": "jane.smith@sheffield.ac.uk",
  "adviserPhone": "+44 123 456 7891",
  "appealType": "Extenuating Circumstances",
  "grounds": ["Illness or medical condition", "Personal circumstances"],
  "statement": "Detailed explanation of the appeal...",
  "moduleCode": "COM1001",
  "academicYear": "2024-25",
  "semester": "1",
  "confirmAll": true
}
```

**Response:**

```json
{
  "message": "Appeal submitted successfully",
  "appeal": {
    "_id": "appeal_id",
    "appealId": "APL-2024-001",
    "status": "submitted",
    "appealType": "Extenuating Circumstances",
    "grounds": ["Illness or medical condition", "Personal circumstances"],
    "student": {
      "_id": "student_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@student.sheffield.ac.uk",
      "studentId": "12345678"
    }
  }
}
```

#### Get Appeals

```http
GET /api/appeals
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**

```json
{
  "appeals": [
    {
      "_id": "appeal_id",
      "appealId": "APL-2024-001",
      "status": "submitted",
      "appealType": "Extenuating Circumstances",
      "firstName": "John",
      "lastName": "Doe",
      "studentId": "12345678",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Get Appeal by ID

```http
GET /api/appeals/:id
```

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "appeal": {
    "_id": "appeal_id",
    "appealId": "APL-2024-001",
    "status": "submitted",
    "appealType": "Extenuating Circumstances",
    "grounds": ["Illness or medical condition"],
    "statement": "Detailed explanation...",
    "student": {
      "_id": "student_id",
      "firstName": "John",
      "lastName": "Doe"
    },
    "timeline": [
      {
        "action": "Appeal submitted",
        "description": "Appeal created and submitted for review",
        "timestamp": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

#### Add Note to Appeal

```http
POST /api/appeals/:id/notes
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "content": "This is a note about the appeal",
  "isInternal": false
}
```

#### Make Decision (Reviewer Only)

```http
PUT /api/appeals/:id/decision
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "outcome": "upheld",
  "reason": "The appeal has merit based on the evidence provided"
}
```

#### Get Dashboard Statistics

```http
GET /api/appeals/dashboard
```

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "statusSummary": {
    "submitted": 5,
    "under review": 3,
    "awaiting information": 1,
    "decision made": 2,
    "resolved": 8,
    "rejected": 1
  },
  "typeCounts": [
    {
      "_id": "Extenuating Circumstances",
      "count": 12
    }
  ],
  "recentAppeals": [...],
  "total": 20
}
```

---

### 🏛️ Admin Operations

#### Get All Appeals (Admin View)

```http
GET /api/admin/appeals
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by appeal status
- `appealType` (optional): Filter by appeal type
- `department` (optional): Filter by student department

**Response:**

```json
{
  "appeals": [
    {
      "_id": "appeal_id",
      "appealId": "APL-2024-001",
      "status": "submitted",
      "appealType": "Extenuating Circumstances",
      "firstName": "John",
      "lastName": "Doe",
      "studentId": "12345678",
      "student": {
        "_id": "student_id",
        "firstName": "John",
        "lastName": "Doe",
        "department": "Computer Science"
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "total": 5,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Get Appeal by ID (Admin View)

```http
GET /api/admin/appeals/:id
```

**Headers:** `Authorization: Bearer <token>`

#### Assign Reviewer/Admin to Appeal

```http
PUT /api/admin/appeals/:id/assign
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "assignedReviewer": "reviewer_user_id",
  "assignedAdmin": "admin_user_id",
  "priority": "high"
}
```

#### Get Admin Dashboard Statistics

```http
GET /api/admin/appeals/dashboard
```

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "statusSummary": {
    "submitted": 5,
    "under review": 3,
    "awaiting information": 1,
    "decision made": 2,
    "resolved": 8,
    "rejected": 1
  },
  "typeCounts": [...],
  "departmentCounts": [...],
  "recentAppeals": [...],
  "total": 20
}
```

#### Search Appeals (Admin View)

```http
GET /api/admin/appeals/search
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `status`: Appeal status
- `appealType`: Type of appeal
- `grounds`: Ground for appeal
- `academicYear`: Academic year
- `semester`: Semester
- `department`: Student department
- `page`: Page number
- `limit`: Items per page

#### Get All Users

```http
GET /api/admin/users
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `role`: Filter by role
- `department`: Filter by department
- `page`: Page number
- `limit`: Items per page

#### Get Reviewers

```http
GET /api/admin/users/reviewers
```

**Headers:** `Authorization: Bearer <token>`

#### Get System Statistics

```http
GET /api/admin/users/stats
```

**Headers:** `Authorization: Bearer <token>`

#### Update User

```http
PUT /api/admin/users/:id
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "department": "Computer Science",
  "isActive": true
}
```

#### Deactivate User

```http
DELETE /api/admin/users/:id
```

**Headers:** `Authorization: Bearer <token>`

---

### 🔍 Reviewer Operations

#### Get Assigned Appeals

```http
GET /api/reviewer/appeals
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by appeal status
- `appealType` (optional): Filter by appeal type

#### Get Appeal by ID (Reviewer View)

```http
GET /api/reviewer/appeals/:id
```

**Headers:** `Authorization: Bearer <token>`

#### Update Appeal Status

```http
PUT /api/reviewer/appeals/:id/status
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "status": "under review",
  "notes": "Starting review process"
}
```

#### Add Internal Note

```http
POST /api/reviewer/appeals/:id/notes
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "content": "Internal review note",
  "isInternal": true
}
```

#### Make Decision

```http
PUT /api/reviewer/appeals/:id/decision
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "outcome": "upheld",
  "reason": "The appeal has merit based on the evidence provided"
}
```

#### Get Reviewer Dashboard

```http
GET /api/reviewer/appeals/dashboard
```

**Headers:** `Authorization: Bearer <token>`

#### Search Appeals (Reviewer View)

```http
GET /api/reviewer/appeals/search
```

**Headers:** `Authorization: Bearer <token>`

---

### 👥 Users

#### Get User by ID

```http
GET /api/users/:id
```

**Headers:** `Authorization: Bearer <token>`

#### Get User's Appeals

```http
GET /api/users/:id/appeals
```

**Headers:** `Authorization: Bearer <token>`

---

## Data Models

### User Model

```json
{
  "_id": "ObjectId",
  "email": "string (unique)",
  "password": "string (hashed)",
  "firstName": "string",
  "lastName": "string",
  "role": "student | admin | reviewer",
  "studentId": "string (unique for students)",
  "department": "string (for admins)",
  "isActive": "boolean",
  "lastLogin": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Appeal Model

```json
{
  "_id": "ObjectId",
  "appealId": "string (unique)",
  "student": "ObjectId (ref: User)",
  "declaration": "boolean",
  "deadlineCheck": "boolean",
  "firstName": "string",
  "lastName": "string",
  "studentId": "string",
  "email": "string",
  "phone": "string",
  "hasAdviser": "boolean",
  "adviserName": "string",
  "adviserEmail": "string",
  "adviserPhone": "string",
  "appealType": "string (enum)",
  "grounds": ["string"],
  "statement": "string",
  "moduleCode": "string",
  "academicYear": "string",
  "semester": "string",
  "status": "string (enum)",
  "priority": "string (enum)",
  "assignedReviewer": "ObjectId (ref: User)",
  "assignedAdmin": "ObjectId (ref: User)",
  "evidence": [
    {
      "filename": "string",
      "originalName": "string",
      "path": "string",
      "fileSize": "number",
      "uploadedAt": "Date"
    }
  ],
  "timeline": [
    {
      "action": "string",
      "description": "string",
      "performedBy": "ObjectId (ref: User)",
      "timestamp": "Date"
    }
  ],
  "notes": [
    {
      "content": "string",
      "author": "ObjectId (ref: User)",
      "timestamp": "Date",
      "isInternal": "boolean"
    }
  ],
  "decision": {
    "outcome": "string (enum)",
    "reason": "string",
    "decisionDate": "Date",
    "decidedBy": "ObjectId (ref: User)"
  },
  "confirmAll": "boolean",
  "submittedDate": "Date",
  "deadline": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## Enums

### Appeal Types

- `Academic Judgment`
- `Procedural Irregularity`
- `Extenuating Circumstances`
- `Assessment Irregularity`
- `Other`

### Appeal Grounds

- `Illness or medical condition`
- `Bereavement`
- `Personal circumstances`
- `Technical issues during assessment`
- `Inadequate supervision`
- `Unclear assessment criteria`
- `Other`

### Appeal Status

- `submitted`
- `under review`
- `awaiting information`
- `decision made`
- `resolved`
- `rejected`

### Appeal Priority

- `low`
- `medium`
- `high`
- `urgent`

### Decision Outcomes

- `upheld`
- `partially upheld`
- `rejected`
- `withdrawn`

### User Roles

- `student`
- `admin`
- `reviewer`

---

## Error Responses

### Validation Error

```json
{
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "First name is required",
      "path": "firstName",
      "location": "body"
    }
  ]
}
```

### Authentication Error

```json
{
  "message": "Access denied. No token provided."
}
```

### Authorization Error

```json
{
  "message": "Access denied. Insufficient permissions."
}
```

### Not Found Error

```json
{
  "message": "Appeal not found"
}
```

### Server Error

```json
{
  "message": "Server error during appeal creation"
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## CORS

CORS is enabled for the configured origin (default: `http://localhost:3000`).

## Testing

Use the provided test script to test the API:

```bash
node test-appeal.js
```

Make sure your server is running on `http://localhost:5000` before running tests.

---

## Support

For API support and questions:

1. Check the server logs for detailed error information
2. Verify your JWT token is valid and not expired
3. Ensure you have the correct permissions for the endpoint
4. Check that all required fields are provided in requests

## Version

This documentation covers API version 1.0.0
