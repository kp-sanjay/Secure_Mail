# QDK Mail — Quantum Secure Email Client

A complete End-to-End Encrypted email application with ISRO-style multi-level security. Encryption/decryption happens on the client side; the backend stores ciphertext plus non-sensitive metadata (classification/mission tags).

## Features

- 🔐 **Multi-Level Security Architecture**
  - **Level 1**: Basic SMTP (clear transport; no payload crypto)
  - **Level 2**: QRNG-seeded HKDF + **CRYSTALS-Kyber (ML-KEM-1024)** key establishment + AES-256-GCM
  - **Level 4**: **ML-KEM-1024** + AES-256-GCM
  - **Level 3**: One-Time Pad remains **disabled** (requires separate pad/QKD logistics)
- 🔑 **Post-Quantum Cryptography on the client**: ML-KEM (Kyber) key establishment + TOFU trust pinning
- 🧾 **Classification & Mission Tags**: Emails carry `classification`, `missionTag`, and `isFlagged` metadata for ISRO-style routing
- 📬 **Inbox / Sent / Threads / View**: Envelope-based decrypt for Level 1/2/4 (server stores ciphertext)
- 🤖 **AI Assistant**: Template-based compose + PQC/SMTP FAQ chatbot
- 📅 **ISRO Mission Calendar**: Real month grid, sidebar event creation, and color-coded mission event types (backed by MongoDB)
- 🖥️ **Electron Desktop (optional)**: OS keychain integration for private key storage

## Tech Stack

### Frontend
- React 18
- Vite
- TailwindCSS
- React Router
- Axios
- Web Crypto API
- framer-motion (animated hexagon background / ISRO UI)
- mlkem (browser Kyber / ML-KEM support)

### Desktop (optional)
- Electron
- keytar (OS keychain integration)

### Backend
- Node.js
- Express (CommonJS)
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs

### Database
- MongoDB Atlas

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Project Structure

```
QDK MAIL/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── emailController.js
│   │   ├── userController.js
│   │   ├── kmsController.js
│   │   ├── qrngController.js
│   │   ├── aiController.js
│   │   └── calendarController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Email.js
│   │   ├── KeyBundle.js
│   │   └── CalendarEvent.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── emailRoutes.js
│   │   ├── userRoutes.js
│   │   ├── qrngRoutes.js
│   │   ├── kmsRoutes.js
│   │   ├── aiRoutes.js
│   │   └── calendarRoutes.js
│   ├── index.js
│   ├── services/
│   │   ├── smtpSender.js
│   │   └── smtpReceiver.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Inbox.jsx
│   │   │   ├── Sent.jsx
│   │   │   ├── Compose.jsx
│   │   │   ├── Drafts.jsx
│   │   │   ├── ThreadView.jsx
│   │   │   ├── ViewEmail.jsx
│   │   │   ├── SecurityDashboard.jsx
│   │   │   ├── Assistant.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Messages.jsx
│   │   │   └── Call.jsx
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   ├── crypto.js
│   │   │   ├── envelope.js
│   │   │   └── pqc.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── desktop/
│   ├── main.cjs
│   ├── preload.cjs
│   └── package.json
└── README.md
```

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `env.example`:
```bash
# On Windows PowerShell:
Copy-Item env.example .env
# On Linux/Mac:
cp env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=your-mongodb-atlas-connection-string
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

5. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional, defaults to localhost):
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## How It Works

### Encryption Flow
1. **User Registration/Login**
   - On signup/login, the client generates:
     - RSA keypair (legacy compatibility / fallback metadata)
     - ML-KEM keypair (Kyber) used for post-quantum Level 2/4
   - The private key bundle is encrypted with the user password and stored locally (and mirrored to OS keychain in Electron).
   - Public keys are published to the server/KMS directory.

2. **Sending Email**
   - User composes an email and selects a security level.
   - **Level 1**: SMTP relay without payload encryption.
   - **Level 2 (Kyber + QRNG)**:
     - Backend returns a simulated QRNG seed (`/api/qrng/seed`)
     - Seed is used as HKDF salt while ML-KEM encapsulation yields a shared secret
     - Shared secret -> HKDF -> AES-256-GCM key; subject/body are encrypted into an envelope.
   - **Level 4**:
     - ML-KEM-1024 encapsulation + HKDF -> AES-256-GCM encryption into an envelope.
   - Email metadata includes `classification` and `missionTag` (non-sensitive).

3. **Receiving Email**
   - The client fetches the envelope ciphertext from MongoDB.
   - Decryption happens locally using the receiver's stored ML-KEM secret key (Level 2/4).
   - Legacy envelopes that used RSA-OAEP-wrapped AES keys remain decryptable.

### Security Features
- **Zero-Knowledge Architecture**: Server never sees plaintext email subject/body
- **Client-Side Encryption/Decryption**: All cryptography happens in the browser
- **Post-Quantum Key Establishment**: ML-KEM (Kyber) used for Level 2/4
- **TOFU Trust Pinning**: Warns the sender when recipient keys change
- **HTTPS Required**: All production traffic must use HTTPS

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Users
- `PUT /api/users/public-key` - Update user's public key (protected)
- `GET /api/users/public-key/:email` - Get user's public key by email (protected)

### Emails
- `POST /api/emails` - Send encrypted email (protected)
- `GET /api/emails/inbox` - Get inbox emails (protected)
- `GET /api/emails/sent` - Get sent emails (protected)
- `GET /api/emails/:id` - Get single email (protected)

### Calendar
- `GET /api/calendar` - List calendar events (protected)
- `POST /api/calendar` - Create a calendar event (protected)
- `PUT /api/calendar/:id` - Update a calendar event (protected)
- `DELETE /api/calendar/:id` - Delete a calendar event (protected)

### Quantum RNG (simulated on backend)
- `GET /api/qrng/seed?bytes=32` - Returns simulated QRNG seed bytes (protected)

### Key Management Service (KMS)
- `PUT /api/kms/keys` - Publish keys (protected)
- `GET /api/kms/me` - Get my keys (protected)
- `GET /api/kms/keys/:email` - Get keys by email (protected)
- `POST /api/kms/revoke` - Revoke keys (protected)

### AI Assistant
- `POST /api/ai/compose` - Generate a professional email draft (protected)
- `POST /api/ai/chat` - FAQ chatbot for KYBER/QRNG/SMTP/key setup (protected)

## Deployment

### MongoDB Atlas Setup

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address (or use 0.0.0.0/0 for Render)
5. Get your connection string

### Backend Deployment (Render)

1. Push your code to GitHub
2. Go to [Render](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repository
5. Configure:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment Variables**:
     - `PORT` (auto-set by Render)
     - `MONGODB_URI` (your MongoDB Atlas connection string)
     - `JWT_SECRET` (generate a strong secret)
     - `NODE_ENV=production`
     - `FRONTEND_URL` (your Vercel frontend URL)
6. Deploy

### Frontend Deployment (Vercel)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your GitHub repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**:
     - `VITE_API_URL` (your Render backend URL + `/api`)
5. Deploy

### Update Environment Variables

After deployment, update:
- Frontend `.env` or Vercel environment variables with production API URL
- Backend `.env` or Render environment variables with production frontend URL

## Future Enhancements
- **Attachments Encryption**: Encrypt file attachments before sending (E2EE)
- **Self-Destruct / Expiry**: Auto-delete or enforce time-bounded viewing for classified content
- **OTP / One-Time Pad (Level 3)**: Requires real pad/key logistics (e.g., QKD + synchronized pad distribution)
- **Post-Quantum Signatures (Dilithium / ML-DSA)**: Signed envelopes for non-repudiation and integrity binding
- **Encrypted Search / Privacy-Preserving Indexing**: Encrypted indexing without leaking keywords

## Security Considerations

⚠️ **Important Security Notes**:

1. **HTTPS Required**: Always use HTTPS in production
2. **Strong Passwords**: Users should use strong passwords
3. **Key Backup**: Users should backup their encrypted private keys
4. **Password Recovery**: Currently, lost passwords mean lost access (by design for security)
5. **Browser Security**: Ensure users use secure, up-to-date browsers
6. **JWT Secret**: Use a strong, random JWT secret in production

## License

ISC

## Support

For issues or questions, please open an issue on the repository.

