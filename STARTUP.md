# Quick Start Guide

## Step 1: Create Environment File

Create a `.env` file in the server directory with this content:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/appeal_system

# JWT Secret (generate a strong secret for production)
JWT_SECRET=dev_jwt_secret_key_2024_appeal_system

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Origin (your frontend URL)
CORS_ORIGIN=http://localhost:3000
```

## Step 2: MongoDB Setup

### Option A: Local MongoDB

1. Install MongoDB Community Edition
2. Start MongoDB service
3. The database `appeal_system` will be created automatically

### Option B: MongoDB Atlas (Cloud)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free account and cluster
3. Get connection string
4. Replace `MONGODB_URI` in `.env` with your Atlas connection string

## Step 3: Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

## Step 4: Test the API

The server will start on `http://localhost:5000`

Test the health check:

```bash
curl http://localhost:5000
# Should return: {"message":"Student Appeal Manager API is running!"}
```

## Step 5: Test Authentication

### Register a test user:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "student",
    "studentId": "12345678"
  }'
```

### Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Error**

   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network access for Atlas

2. **Port Already in Use**

   - Change PORT in `.env` file
   - Kill process using port 5000

3. **JWT Secret Error**

   - Ensure JWT_SECRET is set in `.env`
   - Use a strong, unique secret

4. **CORS Issues**
   - Verify CORS_ORIGIN matches your frontend URL
   - Check browser console for CORS errors

## Next Steps

Once the server is running:

1. Test all API endpoints
2. Integrate with your frontend
3. Add more features as needed
4. Deploy to production

## Support

Check the main README.md for detailed API documentation and development guidelines.
