const express = require('express');
const router = express.Router();
const { updatePublicKey, getPublicKeyByEmail } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.put('/public-key', protect, updatePublicKey);
router.get('/public-key/:email', protect, getPublicKeyByEmail);

module.exports = router;

