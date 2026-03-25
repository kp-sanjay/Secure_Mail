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
  // Versioned envelope supporting security Levels 1-4 (SMTP/plain, quantum-aided AES, OTP, PQC Kyber/ML-KEM)
  envelope: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  securityLevel: {
    type: Number,
    default: null,
  },
  transport: {
    type: String,
    enum: ['api', 'smtp'],
    default: 'api',
  },
  smtpMessageId: {
    type: String,
    default: null,
  },
  // Legacy storage fields (kept for backward compatibility and migration).
  // When `envelope` is present, these may be empty/null.
  encryptedSubject: {
    type: String,
    default: '',
  },
  encryptedBody: {
    type: String,
    default: '',
  },
  encryptedAESKey: {
    type: String,
    default: '',
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
  /** Data classification (mission-style labeling) */
  classification: {
    type: String,
    enum: ['UNCLASSIFIED', 'RESTRICTED', 'SECRET', 'TOP_SECRET'],
    default: 'UNCLASSIFIED',
  },
  /** Mission / program tag (e.g. Chandrayaan-4, Gaganyaan) */
  missionTag: {
    type: String,
    default: null,
    trim: true,
    maxlength: 80,
  },
  isFlagged: {
    type: Boolean,
    default: false,
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

