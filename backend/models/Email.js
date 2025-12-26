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
  // ECDH session key (alternative to RSA-encrypted AES key)
  encryptedECDHKey: {
    type: String,
    default: null,
  },
  // Digital signature for message integrity
  signature: {
    type: String,
    default: null,
  },
  // Nonce/IV for replay attack prevention
  nonce: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // Threading support
  threadId: {
    type: String,
    default: null,
  },
  inReplyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    default: null,
  },
  // Optional fields
  isRead: {
    type: Boolean,
    default: false,
  },
  isDraft: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  selfDestructAt: {
    type: Date,
    default: null,
  },
  // Security classification
  securityScore: {
    type: Number,
    default: null, // 0-100, lower = more suspicious
  },
  category: {
    type: String,
    enum: ['legit', 'spam', 'phishing', 'priority', 'unknown'],
    default: 'unknown',
  },
  // Encrypted search index
  searchIndex: {
    type: String,
    default: null,
  },
});

// Index for efficient queries
emailSchema.index({ receiver: 1, timestamp: -1 });
emailSchema.index({ sender: 1, timestamp: -1 });
emailSchema.index({ threadId: 1, timestamp: -1 });
emailSchema.index({ receiver: 1, isDraft: 1 });
emailSchema.index({ category: 1 });
emailSchema.index({ securityScore: 1 });

module.exports = mongoose.model('Email', emailSchema);

