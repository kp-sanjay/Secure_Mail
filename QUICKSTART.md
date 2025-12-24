# Quick Start Guide

Get the E2EE Email Client running locally in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- MongoDB Atlas account (free tier works)

## Step 1: Clone and Setup

```bash
# Navigate to project directory
cd "E2EE Email"
```

## Step 2: Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file
# Copy env.example to .env and update with your values
# On Windows PowerShell:
Copy-Item env.example .env
# On Linux/Mac:
# cp env.example .env

# Edit .env with your MongoDB connection string
# Get connection string from MongoDB Atlas:
# 1. Go to Clusters → Connect → Connect your application
# 2. Copy the connection string
# 3. Replace <password> with your database user password
# 4. Replace <dbname> with 'e2ee-email'
```

Update `.env`:
```env
PORT=5000
MONGODB_URI=your-mongodb-connection-string-here
JWT_SECRET=your-random-secret-key-here
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

```bash
# Start backend server
npm run dev
```

Backend should be running on `http://localhost:5000`

## Step 3: Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend should be running on `http://localhost:5173`

## Step 4: Test the Application

1. Open `http://localhost:5173` in your browser
2. Register a new account
3. On first login, RSA keys will be automatically generated
4. Register a second account in an incognito window
5. Send an email from one account to the other
6. Check inbox and decrypt the email

## Troubleshooting

### Backend won't start
- Check MongoDB connection string is correct
- Verify MongoDB Atlas IP whitelist includes your IP (or 0.0.0.0/0 for testing)
- Check PORT 5000 is not already in use

### Frontend won't start
- Check PORT 5173 is not already in use
- Verify Node.js version is 16+

### Can't send emails
- Make sure both users have registered and logged in (keys are generated on first login)
- Check browser console for errors
- Verify backend is running and accessible

### Encryption errors
- Make sure you're using a modern browser (Chrome, Firefox, Edge)
- Check browser console for Web Crypto API errors
- Verify private key is loaded (check localStorage)

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Explore the code to understand the encryption flow

## Development Tips

- Backend auto-reloads with nodemon
- Frontend hot-reloads with Vite
- Check browser DevTools → Application → Local Storage to see stored keys
- Use MongoDB Atlas web interface to inspect stored data (all encrypted!)

