const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { compose, chat } = require('../controllers/aiController');

router.post('/compose', protect, compose);
router.post('/chat', protect, chat);

module.exports = router;

