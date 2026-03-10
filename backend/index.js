const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/emails', require('./routes/emailRoutes'));
app.use('/api/qrng', require('./routes/qrngRoutes'));
app.use('/api/kms', require('./routes/kmsRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'E2EE Email Backend is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Optional: start inbound SMTP listener (stores received messages into MongoDB)
try {
  const { startInboundSmtpServer } = require('./services/smtpReceiver');
  startInboundSmtpServer();
} catch (e) {
  console.warn('SMTP inbound server not started:', e?.message || e);
}

