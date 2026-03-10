const mongoose = require('mongoose');
const crypto = require('crypto');

function fingerprintOf(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

const keyRecordSchema = new mongoose.Schema(
  {
    kty: { type: String, required: true }, // e.g. 'rsa', 'mlkem'
    alg: { type: String, required: true }, // e.g. 'RSA-OAEP-2048', 'ML-KEM-768'
    publicKey: { type: String, required: true },
    fingerprint: { type: String, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    createdAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { _id: false }
);

const keyBundleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    keys: { type: [keyRecordSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

keyBundleSchema.index({ email: 1 });
keyBundleSchema.index({ user: 1 }, { unique: true });
keyBundleSchema.index({ 'keys.fingerprint': 1 });

keyBundleSchema.statics.fingerprintOf = fingerprintOf;

module.exports = mongoose.model('KeyBundle', keyBundleSchema);

