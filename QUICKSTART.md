# Quick Start Guide

Get the **Adaptive E2EE Email Client** running locally in 5 minutes. This app features end-to-end encryption, AI-powered phishing detection, behavioral anomaly detection, and more!

## Prerequisites

- **Node.js 16+** installed
- **MongoDB Atlas account** (free tier works)
- **Modern browser** with Web Crypto API support (Chrome, Firefox, Edge)

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

## Step 4: Explore the Application

### 🎯 **Guest Mode (No Login Required!)**
1. Open `http://localhost:5173` in your browser
2. **You can browse the app without logging in!** 
3. Navigate through Inbox, Sent, Compose, Drafts, and Security Dashboard
4. Login is optional - only required for sending/receiving emails

### 🔐 **User Registration & Login**
1. Click "Sign Up" or navigate to `/register`
2. Create an account with name, email, and password
3. **Argon2 password hashing** is used by default (more secure than bcrypt)
4. On first login, **multiple encryption keys are automatically generated**:
   - RSA-2048 keys (for encryption)
   - ECC-256 keys (for ECDH key exchange)
   - ECDSA keys (for digital signatures)

### 📧 **Sending Encrypted Emails**
1. Click "Compose" to create a new email
2. **Real-time phishing detection** will warn you if content looks suspicious
3. Enter recipient email, subject, and message
4. Click "Send" - the email is encrypted using:
   - **AES-256-GCM** for message content
   - **ECDH** for session key exchange (or RSA fallback)
   - **ECDSA** digital signature for integrity
   - **Timestamp-based nonces** to prevent replay attacks
5. Or click "Save Draft" to save for later

### 📬 **Receiving & Reading Emails**
1. Check your **Inbox** for received emails
2. Click on an email to decrypt and read it
3. Use **Search** to find emails by sender, subject, or category
4. Switch to **Thread View** to see email conversations grouped together
5. View **Drafts** to edit unsent emails

### 🛡️ **Security Features**
1. Visit the **Security Dashboard** (`/dashboard`) to see:
   - Phishing detection statistics
   - Behavioral anomaly alerts
   - Recent threats and security scores
   - Auto-categorized emails (Spam/Phishing/Legit/Priority)
2. **Mark emails as safe or phishing** to improve ML model accuracy
3. View **behavioral anomalies** like unusual send times or recipients

### 🔍 **Advanced Features**
- **Threaded Conversations**: Emails with same threadId are grouped
- **Search & Filter**: Find emails quickly with encrypted content indexing
- **Draft Management**: Save, edit, and delete drafts
- **Local Storage**: Keys and preferences stored securely in browser
- **Smart Filtering**: AI automatically categorizes emails

## Key Features Overview

### 🔐 **Encryption & Security**
- **Multiple Encryption Methods**: RSA-2048, ECC-256, ECDH, ECDSA
- **AES-256-GCM** for message encryption
- **Digital Signatures** for message integrity
- **Replay Attack Prevention** with timestamp-based nonces
- **Argon2 Password Hashing** (more secure than bcrypt)

### 🤖 **AI-Powered Security**
- **Phishing Detection**: Naive Bayes ML model scans emails in real-time
- **Behavioral Anomaly Detection**: Flags unusual user patterns
- **Smart Filtering**: Auto-categorizes emails (Spam/Phishing/Legit/Priority)
- **Risk Scoring**: Each email gets a security score (0-100)

### 📧 **Email Features**
- **Draft Folder**: Save emails before sending
- **Threaded View**: Group conversations together
- **Search & Filter**: Find emails quickly
- **Encrypted Search Indexes**: Search without decrypting content
- **Local Caching**: Offline email access

### 👤 **User Experience**
- **Guest Mode**: Browse without login
- **Optional Authentication**: Login only when needed
- **Security Dashboard**: Visual threat monitoring
- **User Feedback Loop**: Improve ML models by marking emails

## Troubleshooting

### Backend won't start
- Check MongoDB connection string is correct
- Verify MongoDB Atlas IP whitelist includes your IP (or 0.0.0.0/0 for testing)
- Check PORT 5000 is not already in use
- Ensure all dependencies are installed: `npm install`

### Frontend won't start
- Check PORT 5173 is not already in use
- Verify Node.js version is 16+
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Can't send emails
- Make sure both users have registered and logged in (keys are generated on first login)
- Check browser console for errors
- Verify backend is running and accessible
- Ensure recipient has set up their encryption keys

### Encryption errors
- Make sure you're using a modern browser (Chrome, Firefox, Edge)
- Check browser console for Web Crypto API errors
- Verify private key is loaded (check DevTools → Application → Local Storage)
- Try logging out and logging back in to regenerate keys

### Phishing detection not working
- Check browser console for ML model errors
- Ensure you have internet connection (for initial model training)
- Try refreshing the page to reload the model

### Local storage issues
- Clear browser cache and localStorage if experiencing issues
- Check browser storage quota (localStorage has ~5-10MB limit)
- Use DevTools → Application → Local Storage to inspect stored data

## Testing the Full Feature Set

### Test Phishing Detection
1. Compose an email with suspicious content (e.g., "URGENT: Verify your account")
2. Notice the **security warning** appears in real-time
3. Check the risk score and level (Low/Medium/High)

### Test Draft Functionality
1. Start composing an email
2. Click "Save Draft" before sending
3. Go to Drafts folder to see saved draft
4. Click "Edit" to continue composing
5. Send or delete the draft

### Test Threading
1. Send an email to another user
2. Reply to that email (creates a thread)
3. Switch to "Thread View" in Inbox
4. See all related emails grouped together

### Test Search
1. Send/receive several emails
2. Use the search bar in Inbox
3. Search by sender name, email, or subject keywords
4. Results filter in real-time

### Test Security Dashboard
1. Send/receive emails with various content
2. Navigate to Security Dashboard (`/dashboard`)
3. View statistics, threats, and anomalies
4. Mark emails as safe/phishing to train the model

### Test Behavioral Anomaly Detection
1. Send emails at unusual times
2. Send to new recipients
3. Send bulk emails
4. Check Security Dashboard for anomaly alerts

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for feature details
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Explore the code to understand the encryption flow and ML models

## Development Tips

- **Backend**: Auto-reloads with nodemon on file changes
- **Frontend**: Hot-reloads with Vite HMR (instant updates)
- **Debugging**: 
  - Check browser DevTools → Application → Local Storage to see stored keys
  - Use MongoDB Atlas web interface to inspect stored data (all encrypted!)
  - Check browser console for ML model predictions and anomaly detection logs
- **Testing**: Use incognito windows to test multiple user accounts
- **ML Models**: Phishing detector and anomaly detector improve with user feedback

## Architecture Highlights

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Node.js + Express + MongoDB + Mongoose
- **Encryption**: Web Crypto API (client-side)
- **ML**: Naive Bayes (phishing), Isolation Forest-inspired (anomalies)
- **Storage**: MongoDB (server) + localStorage (client)
- **Auth**: JWT + Argon2/bcrypt password hashing

