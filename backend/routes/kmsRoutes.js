const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { publishKeys, getKeysByEmail, revokeKeys, getMyKeys } = require('../controllers/kmsController');

router.get('/me', protect, getMyKeys);
router.put('/keys', protect, publishKeys);
router.get('/keys/:email', protect, getKeysByEmail);
router.post('/revoke', protect, revokeKeys);

module.exports = router;

