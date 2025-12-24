# E2EE Email Client

A complete End-to-End Encrypted Email Client web application where only the sender and recipient can read messages. All encryption and decryption happens on the client side, and the backend only stores ciphertext.

## Features

- 🔐 **End-to-End Encryption**: RSA + AES hybrid encryption
- 🔑 **Client-Side Key Management**: Private keys never leave the client device
- 👤 **User Authentication**: JWT-based authentication
- 📧 **Secure Email**: Encrypted subject, body, and AES keys
- 📬 **Inbox & Sent Box**: View received and sent emails
- 🎨 **Modern UI**: Responsive design with TailwindCSS
- 🚀 **Production Ready**: Deployment configurations included

## Tech Stack

### Frontend
- React 18
- Vite
- TailwindCSS
- React Router
- Axios
- Web Crypto API

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
E2EE Email/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── emailController.js
│   │   └── userController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   └── Email.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── emailRoutes.js
│   │   └── userRoutes.js
│   ├── index.js
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
│   │   │   └── ViewEmail.jsx
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── crypto.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
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

1. **User Registration/Login**:
   - User registers or logs in
   - RSA key pair is generated on the client
   - Private key is encrypted with user's password and stored locally
   - Public key is uploaded to the server

2. **Sending Email**:
   - User composes an email
   - AES key is generated for the message
   - Email subject and body are encrypted with AES
   - AES key is encrypted with receiver's public RSA key
   - Only encrypted data is sent to the server

3. **Receiving Email**:
   - Encrypted email is fetched from server
   - AES key is decrypted using receiver's private RSA key
   - Email subject and body are decrypted using AES key
   - Plaintext is displayed to the user

### Security Features

- **Zero-Knowledge Architecture**: Server never sees plaintext
- **Client-Side Encryption**: All encryption/decryption happens in the browser
- **Password-Protected Private Keys**: Private keys are encrypted with user password
- **RSA + AES Hybrid**: RSA for key exchange, AES for message encryption
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

The following modules are placeholders for future implementation:

- **Attachments Encryption**: Encrypt file attachments before sending
- **Self-Destruct Timer**: Auto-delete emails after a set time
- **QR-Based Key Sharing**: Share public keys via QR codes

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

