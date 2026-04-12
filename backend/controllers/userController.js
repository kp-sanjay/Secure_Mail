const User = require('../models/User');

// @desc    Update user's public keys
// @route   PUT /api/users/public-key
// @access  Private
const updatePublicKey = async (req, res) => {
  try {
    const { publicKey, eccPublicKey, ecdsaPublicKey, mlkemPublicKey, keyCapabilities } = req.body;

    const updateData = {};
    if (publicKey) {
      if (typeof publicKey !== 'string' || publicKey.length < 100) {
        return res.status(400).json({ message: 'Invalid RSA public key format' });
      }
      updateData.publicKey = publicKey;
    }
    if (eccPublicKey) {
      updateData.eccPublicKey = eccPublicKey;
    }
    if (ecdsaPublicKey) {
      updateData.ecdsaPublicKey = ecdsaPublicKey;
    }
    if (mlkemPublicKey) {
      if (typeof mlkemPublicKey !== 'string' || mlkemPublicKey.length < 80) {
        return res.status(400).json({ message: 'Invalid ML-KEM public key format' });
      }
      updateData.mlkemPublicKey = mlkemPublicKey;
    }
    if (Array.isArray(keyCapabilities)) {
      updateData.keyCapabilities = keyCapabilities.filter((x) => typeof x === 'string');
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'At least one public key is required' });
    }

    updateData.keyUpdatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Public keys updated successfully',
      publicKey: user.publicKey,
      eccPublicKey: user.eccPublicKey,
      ecdsaPublicKey: user.ecdsaPublicKey,
      mlkemPublicKey: user.mlkemPublicKey,
      keyCapabilities: user.keyCapabilities,
      keyUpdatedAt: user.keyUpdatedAt,
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

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      'publicKey eccPublicKey ecdsaPublicKey mlkemPublicKey keyCapabilities keyUpdatedAt name email'
    );

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
      eccPublicKey: user.eccPublicKey,
      ecdsaPublicKey: user.ecdsaPublicKey,
      mlkemPublicKey: user.mlkemPublicKey,
      keyCapabilities: user.keyCapabilities,
      keyUpdatedAt: user.keyUpdatedAt,
    });
  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({ message: 'Server error fetching public key' });
  }
};

// @desc    Get all users for contacts list
// @route   GET /api/users/contacts
// @access  Private
const getContacts = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('name email department jobRole')
      .sort({ name: 1 });
    res.json(users);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ message: 'Server error fetching contacts' });
  }
};

module.exports = {
  updatePublicKey,
  getPublicKeyByEmail,
  getContacts,
};

