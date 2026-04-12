const express = require('express');
const router = express.Router();
const { updatePublicKey, getPublicKeyByEmail, getContacts } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.put('/public-key', protect, updatePublicKey);
router.get('/public-key/:email', protect, getPublicKeyByEmail);
router.get('/contacts', protect, getContacts);

module.exports = router;

