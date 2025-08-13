# Student Appeal Manager (SAM) - Backend

A Node.js backend for the Student Appeal Manager system, built with Express.js and MongoDB.

## Features

- **Authentication System**: JWT-based authentication with role-based access control
- **User Management**: Support for students, admins, and reviewers
- **Appeal Management**: Complete CRUD operations for student appeals
- **Role-Based Access Control**: Different permissions for different user roles
- **Timeline Tracking**: Complete audit trail for all appeal activities
- **Notes System**: Internal and public notes for appeals
- **Decision Management**: Reviewers can make decisions on appeals

## Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (v5 or higher)
- **npm** or **yarn**

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Environment Configuration

Create a `.env` file in the server directory:

```bash
cp env.example .env
```

Edit the `.env` file with your configuration:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/appeal_system

# JWT Secret (generate a strong secret)
JWT_SECRET=your_super_secret_jwt_key_here

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Origin (your frontend URL)
CORS_ORIGIN=http://localhost:3000
```

### 3. MongoDB Setup

#### Option A: Local MongoDB

1. Install MongoDB locally
2. Start MongoDB service
3. Create database: `appeal_system`

#### Option B: MongoDB Atlas (Cloud)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### 4. Start the Server

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - User logout

### Appeals

- `POST /api/appeals` - Create new appeal (students only)
- `GET /api/appeals` - Get appeals (role-based access)
- `GET /api/appeals/:id` - Get specific appeal
- `PUT /api/appeals/:id` - Update appeal (admin/reviewer only)
- `POST /api/appeals/:id/notes` - Add note to appeal
- `PUT /api/appeals/:id/decision` - Make decision (reviewer only)

### Users

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/reviewers` - Get all reviewers
- `GET /api/users/admins` - Get all admins
- `GET /api/users/:id` - Get specific user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (admin only)
- `GET /api/users/:id/appeals` - Get user's appeals
- `GET /api/users/stats/overview` - Get statistics (admin only)

## User Roles & Permissions

### Student

- Create and manage own appeals
- View own appeal history
- Add public notes to own appeals
- Update profile information

### Admin

- View all appeals
- Assign reviewers and admins to appeals
- Update appeal status and priority
- Manage user accounts
- View system statistics
- Add internal notes

### Reviewer

- View assigned appeals
- Review and make decisions on appeals
- Add internal notes
- Update appeal status

## Data Models

### User

- Basic info (name, email, password)
- Role (student, admin, reviewer)
- Student-specific fields (student ID)
- Admin-specific fields (department)
- Account status and timestamps

### Appeal

- Appeal details (title, description, grounds)
- Academic context (module, year, semester)
- Status tracking and timeline
- Assignment information
- Decision details
- Notes and documents

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Express-validator for request validation
- **Role-Based Access Control**: Middleware for route protection
- **CORS Configuration**: Configurable cross-origin requests

## Error Handling

- Comprehensive error handling middleware
- Validation error responses
- Proper HTTP status codes
- Detailed error logging

## Development

### Project Structure

```
server/
├── models/          # MongoDB schemas
├── routes/          # API route handlers
├── middleware/      # Custom middleware
├── server.js        # Main server file
├── package.json     # Dependencies
└── .env            # Environment variables
```

### Adding New Features

1. Create/update models in `models/`
2. Add routes in `routes/`
3. Update middleware if needed
4. Test with appropriate role permissions

## Testing

The API can be tested using tools like:

- Postman
- Insomnia
- curl commands
- Frontend integration

## Deployment

### Environment Variables

- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure production MongoDB URI
- Set appropriate CORS origin

### Security Considerations

- Use HTTPS in production
- Implement rate limiting
- Add request logging
- Regular security updates

## Support

For issues or questions:

1. Check the error logs
2. Verify environment configuration
3. Ensure MongoDB is running
4. Check user permissions and roles

## License

MIT License - see LICENSE file for details.
