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

// @desc    Save draft email
// @route   POST /api/emails/draft
// @access  Private
const saveDraft = async (req, res) => {
  try {
    const { receiverEmail, encryptedSubject, encryptedBody, encryptedAESKey, threadId, inReplyTo } = req.body;

    // Find receiver if provided
    let receiver = null;
    if (receiverEmail) {
      receiver = await User.findOne({ email: receiverEmail.toLowerCase() });
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }
    }

    // Create draft
    const draft = await Email.create({
      sender: req.user._id,
      receiver: receiver?._id || req.user._id, // Default to self if no receiver
      encryptedSubject: encryptedSubject || '',
      encryptedBody: encryptedBody || '',
      encryptedAESKey: encryptedAESKey || '',
      isDraft: true,
      threadId: threadId || null,
      inReplyTo: inReplyTo || null,
      nonce: req.body.nonce || Date.now().toString(),
    });

    res.status(201).json({
      message: 'Draft saved successfully',
      draftId: draft._id,
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ message: 'Server error saving draft' });
  }
};

// @desc    Get draft emails
// @route   GET /api/emails/drafts
// @access  Private
const getDrafts = async (req, res) => {
  try {
    const drafts = await Email.find({
      sender: req.user._id,
      isDraft: true,
      isDeleted: false,
    })
      .populate('receiver', 'name email')
      .sort({ timestamp: -1 });

    res.json(drafts);
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ message: 'Server error fetching drafts' });
  }
};

// @desc    Delete draft
// @route   DELETE /api/emails/draft/:id
// @access  Private
const deleteDraft = async (req, res) => {
  try {
    const draft = await Email.findById(req.params.id);

    if (!draft) {
      return res.status(404).json({ message: 'Draft not found' });
    }

    if (draft.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    draft.isDeleted = true;
    await draft.save();

    res.json({ message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ message: 'Server error deleting draft' });
  }
};

// @desc    Search emails
// @route   GET /api/emails/search
// @access  Private
const searchEmails = async (req, res) => {
  try {
    const { query, folder } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    let searchFilter = {};
    if (folder === 'inbox') {
      searchFilter = { receiver: req.user._id, isDraft: false, isDeleted: false };
    } else if (folder === 'sent') {
      searchFilter = { sender: req.user._id, isDraft: false, isDeleted: false };
    } else {
      searchFilter = {
        $or: [
          { receiver: req.user._id },
          { sender: req.user._id },
        ],
        isDraft: false,
        isDeleted: false,
      };
    }

    // Search in encrypted indexes (simplified - in production use proper encrypted search)
    const emails = await Email.find({
      ...searchFilter,
      $or: [
        { searchIndex: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(emails);
  } catch (error) {
    console.error('Search emails error:', error);
    res.status(500).json({ message: 'Server error searching emails' });
  }
};

// @desc    Get threaded emails
// @route   GET /api/emails/thread/:threadId
// @access  Private
const getThread = async (req, res) => {
  try {
    const { threadId } = req.params;

    const emails = await Email.find({
      threadId: threadId,
      isDeleted: false,
      $or: [
        { receiver: req.user._id },
        { sender: req.user._id },
      ],
    })
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ timestamp: 1 }); // Oldest first for thread view

    res.json(emails);
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ message: 'Server error fetching thread' });
  }
};

// @desc    Update email category (for ML feedback)
// @route   PUT /api/emails/:id/category
// @access  Private
const updateEmailCategory = async (req, res) => {
  try {
    const { category, securityScore } = req.body;

    const email = await Email.findById(req.params.id);

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // Check authorization
    if (
      email.sender.toString() !== req.user._id.toString() &&
      email.receiver.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (category) {
      email.category = category;
    }
    if (securityScore !== undefined) {
      email.securityScore = securityScore;
    }

    await email.save();

    res.json({ message: 'Email category updated', email });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error updating category' });
  }
};

// @desc    Send email (enhanced with ECDH, signatures, etc.)
// @route   POST /api/emails
// @access  Private
const sendEmailEnhanced = async (req, res) => {
  try {
    const {
      receiverEmail,
      encryptedSubject,
      encryptedBody,
      encryptedAESKey,
      encryptedECDHKey,
      signature,
      nonce,
      threadId,
      inReplyTo,
      searchIndex,
    } = req.body;

    // Validation
    if (!receiverEmail || !encryptedSubject || !encryptedBody || (!encryptedAESKey && !encryptedECDHKey)) {
      return res.status(400).json({
        message: 'Please provide receiver email, encrypted subject, body, and encryption key',
      });
    }

    // Find receiver
    const receiver = await User.findOne({ email: receiverEmail.toLowerCase() });
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Generate threadId if replying
    let finalThreadId = threadId;
    if (inReplyTo && !threadId) {
      const parentEmail = await Email.findById(inReplyTo);
      finalThreadId = parentEmail?.threadId || inReplyTo;
    } else if (!threadId) {
      finalThreadId = new Date().getTime().toString(); // New thread
    }

    // Create email
    const email = await Email.create({
      sender: req.user._id,
      receiver: receiver._id,
      encryptedSubject,
      encryptedBody,
      encryptedAESKey: encryptedAESKey || null,
      encryptedECDHKey: encryptedECDHKey || null,
      signature: signature || null,
      nonce: nonce || Date.now().toString(),
      threadId: finalThreadId,
      inReplyTo: inReplyTo || null,
      searchIndex: searchIndex || null,
      isDraft: false,
    });

    res.status(201).json({
      message: 'Email sent successfully',
      emailId: email._id,
      threadId: finalThreadId,
      timestamp: email.timestamp,
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ message: 'Server error sending email' });
  }
};

module.exports = {
  sendEmail: sendEmailEnhanced,
  getInbox,
  getSent,
  getEmail,
  saveDraft,
  getDrafts,
  deleteDraft,
  searchEmails,
  getThread,
  updateEmailCategory,
};

