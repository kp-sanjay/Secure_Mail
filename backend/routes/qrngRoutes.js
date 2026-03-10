const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getSeed } = require('../controllers/qrngController');

router.get('/seed', protect, getSeed);

module.exports = router;

