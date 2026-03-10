const crypto = require('crypto');

// @desc    Return quantum-random seed bytes (simulated if no provider)
// @route   GET /api/qrng/seed?bytes=32
// @access  Private (uses JWT)
const getSeed = async (req, res) => {
  const bytes = Math.max(16, Math.min(1024, Number(req.query.bytes || 32)));
  const buf = crypto.randomBytes(bytes);
  res.json({
    bytes,
    seedB64: buf.toString('base64'),
    source: 'simulated-qrng',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { getSeed };

