const User = require('../models/User');

// @desc    Update user's public key
// @route   PUT /api/users/public-key
// @access  Private
const updatePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ message: 'Public key is required' });
    }

    // Validate public key format (basic check)
    if (typeof publicKey !== 'string' || publicKey.length < 100) {
      return res.status(400).json({ message: 'Invalid public key format' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { publicKey },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Public key updated successfully',
      publicKey: user.publicKey,
    });
  } catch (error) {
    console.error('Update public key error:', error);
    res.status(500).json({ message: 'Server error updating public key' });
  }
};

// @desc    Get user's public key by email
// @route   GET /api/users/public-key/:email
// @access  Private
const getPublicKeyByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('publicKey name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.publicKey) {
      return res.status(404).json({ message: 'User has not set up encryption keys yet' });
    }

    res.json({
      email: user.email,
      name: user.name,
      publicKey: user.publicKey,
    });
  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({ message: 'Server error fetching public key' });
  }
};

module.exports = {
  updatePublicKey,
  getPublicKeyByEmail,
};

