const KeyBundle = require('../models/KeyBundle');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function asKeyRecordsFromPayload(payload) {
  const out = [];
  if (payload.publicKey) {
    out.push({ kty: 'rsa', alg: 'RSA-OAEP-2048', publicKey: payload.publicKey });
  }
  if (payload.mlkemPublicKey) {
    out.push({ kty: 'mlkem', alg: 'ML-KEM-768', publicKey: payload.mlkemPublicKey });
  }
  if (payload.eccPublicKey) {
    out.push({ kty: 'ecdh', alg: 'ECDH-P256', publicKey: payload.eccPublicKey });
  }
  if (payload.ecdsaPublicKey) {
    out.push({ kty: 'ecdsa', alg: 'ECDSA-P256', publicKey: payload.ecdsaPublicKey });
  }
  return out;
}

// @desc    Publish (add/update) keys for current user
// @route   PUT /api/kms/keys
// @access  Private
const publishKeys = async (req, res) => {
  try {
    const email = normalizeEmail(req.user.email);
    const records = asKeyRecordsFromPayload(req.body);
    if (records.length === 0) {
      return res.status(400).json({ message: 'No keys provided' });
    }

    const now = new Date();
    const fp = KeyBundle.fingerprintOf;
    const recordsWithFp = records.map((r) => ({
      ...r,
      fingerprint: fp(`${r.alg}:${r.publicKey}`),
      status: 'active',
      createdAt: now,
      revokedAt: null,
    }));

    let bundle = await KeyBundle.findOne({ user: req.user._id });
    if (!bundle) {
      bundle = await KeyBundle.create({
        user: req.user._id,
        email,
        keys: recordsWithFp,
        updatedAt: now,
      });
    } else {
      // Re-activate if same fingerprint exists; otherwise append new record.
      const existing = new Set(bundle.keys.map((k) => k.fingerprint));
      for (const r of recordsWithFp) {
        if (existing.has(r.fingerprint)) {
          bundle.keys = bundle.keys.map((k) =>
            k.fingerprint === r.fingerprint
              ? { ...k.toObject?.() ? k.toObject() : k, status: 'active', revokedAt: null }
              : k
          );
        } else {
          bundle.keys.push(r);
        }
      }
      bundle.updatedAt = now;
      await bundle.save();
    }

    res.json({
      message: 'Keys published',
      email: bundle.email,
      updatedAt: bundle.updatedAt,
      activeKeys: bundle.keys.filter((k) => k.status === 'active'),
    });
  } catch (error) {
    console.error('Publish keys error:', error);
    res.status(500).json({ message: 'Server error publishing keys' });
  }
};

// @desc    Fetch keys by email
// @route   GET /api/kms/keys/:email
// @access  Private
const getKeysByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.params.email);
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const bundle = await KeyBundle.findOne({ email });
    if (!bundle) return res.status(404).json({ message: 'No key bundle found for user' });

    res.json({
      email: bundle.email,
      updatedAt: bundle.updatedAt,
      activeKeys: bundle.keys.filter((k) => k.status === 'active'),
    });
  } catch (error) {
    console.error('Get keys error:', error);
    res.status(500).json({ message: 'Server error fetching keys' });
  }
};

// @desc    Revoke keys (by fingerprint or alg)
// @route   POST /api/kms/revoke
// @access  Private
const revokeKeys = async (req, res) => {
  try {
    const { fingerprint, alg } = req.body || {};
    if (!fingerprint && !alg) {
      return res.status(400).json({ message: 'Provide fingerprint or alg to revoke' });
    }

    const bundle = await KeyBundle.findOne({ user: req.user._id });
    if (!bundle) return res.status(404).json({ message: 'Key bundle not found' });

    const now = new Date();
    let changed = false;
    bundle.keys = bundle.keys.map((k) => {
      const match = (fingerprint && k.fingerprint === fingerprint) || (alg && k.alg === alg);
      if (!match || k.status === 'revoked') return k;
      changed = true;
      return { ...(k.toObject?.() ? k.toObject() : k), status: 'revoked', revokedAt: now };
    });

    if (!changed) {
      return res.status(404).json({ message: 'No matching active keys found to revoke' });
    }

    bundle.updatedAt = now;
    await bundle.save();

    res.json({
      message: 'Keys revoked',
      updatedAt: bundle.updatedAt,
      activeKeys: bundle.keys.filter((k) => k.status === 'active'),
    });
  } catch (error) {
    console.error('Revoke keys error:', error);
    res.status(500).json({ message: 'Server error revoking keys' });
  }
};

// @desc    Get current user's key bundle
// @route   GET /api/kms/me
// @access  Private
const getMyKeys = async (req, res) => {
  try {
    const bundle = await KeyBundle.findOne({ user: req.user._id });
    if (!bundle) return res.json({ email: normalizeEmail(req.user.email), updatedAt: null, activeKeys: [] });

    res.json({
      email: bundle.email,
      updatedAt: bundle.updatedAt,
      activeKeys: bundle.keys.filter((k) => k.status === 'active'),
    });
  } catch (error) {
    console.error('Get my keys error:', error);
    res.status(500).json({ message: 'Server error fetching keys' });
  }
};

module.exports = { publishKeys, getKeysByEmail, revokeKeys, getMyKeys };

