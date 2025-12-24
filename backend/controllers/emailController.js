const Email = require('../models/Email');
const User = require('../models/User');

// @desc    Send an encrypted email
// @route   POST /api/emails
// @access  Private
const sendEmail = async (req, res) => {
  try {
    const { receiverEmail, encryptedSubject, encryptedBody, encryptedAESKey } = req.body;

    // Validation
    if (!receiverEmail || !encryptedSubject || !encryptedBody || !encryptedAESKey) {
      return res.status(400).json({
        message: 'Please provide receiver email, encrypted subject, body, and AES key',
      });
    }

    // Find receiver
    const receiver = await User.findOne({ email: receiverEmail.toLowerCase() });
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Validate encrypted data format (basic checks)
    if (
      typeof encryptedSubject !== 'string' ||
      typeof encryptedBody !== 'string' ||
      typeof encryptedAESKey !== 'string'
    ) {
      return res.status(400).json({ message: 'Invalid encrypted data format' });
    }

    // Create email
    const email = await Email.create({
      sender: req.user._id,
      receiver: receiver._id,
      encryptedSubject,
      encryptedBody,
      encryptedAESKey,
    });

    res.status(201).json({
      message: 'Email sent successfully',
      emailId: email._id,
      timestamp: email.timestamp,
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ message: 'Server error sending email' });
  }
};

// @desc    Get inbox emails (received)
// @route   GET /api/emails/inbox
// @access  Private
const getInbox = async (req, res) => {
  try {
    const emails = await Email.find({ receiver: req.user._id })
      .populate('sender', 'name email')
      .sort({ timestamp: -1 })
      .select('encryptedSubject encryptedBody encryptedAESKey timestamp isRead sender');

    res.json(emails);
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ message: 'Server error fetching inbox' });
  }
};

// @desc    Get sent emails
// @route   GET /api/emails/sent
// @access  Private
const getSent = async (req, res) => {
  try {
    const emails = await Email.find({ sender: req.user._id })
      .populate('receiver', 'name email')
      .sort({ timestamp: -1 })
      .select('encryptedSubject encryptedBody encryptedAESKey timestamp receiver');

    res.json(emails);
  } catch (error) {
    console.error('Get sent error:', error);
    res.status(500).json({ message: 'Server error fetching sent emails' });
  }
};

// @desc    Get single email by ID
// @route   GET /api/emails/:id
// @access  Private
const getEmail = async (req, res) => {
  try {
    const email = await Email.findById(req.params.id)
      .populate('sender', 'name email')
      .populate('receiver', 'name email');

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // Check if user is sender or receiver
    if (
      email.sender._id.toString() !== req.user._id.toString() &&
      email.receiver._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized to view this email' });
    }

    // Mark as read if receiver
    if (email.receiver._id.toString() === req.user._id.toString() && !email.isRead) {
      email.isRead = true;
      await email.save();
    }

    res.json(email);
  } catch (error) {
    console.error('Get email error:', error);
    res.status(500).json({ message: 'Server error fetching email' });
  }
};

module.exports = {
  sendEmail,
  getInbox,
  getSent,
  getEmail,
};

