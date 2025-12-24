const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  encryptedSubject: {
    type: String,
    required: true,
  },
  encryptedBody: {
    type: String,
    required: true,
  },
  encryptedAESKey: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // Optional fields for future features
  isRead: {
    type: Boolean,
    default: false,
  },
  selfDestructAt: {
    type: Date,
    default: null,
  },
});

// Index for efficient queries
emailSchema.index({ receiver: 1, timestamp: -1 });
emailSchema.index({ sender: 1, timestamp: -1 });

module.exports = mongoose.model('Email', emailSchema);

