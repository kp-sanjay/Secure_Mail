const express = require('express');
const router = express.Router();
const {
  sendEmail,
  getInbox,
  getSent,
  getEmail,
} = require('../controllers/emailController');
const { protect } = require('../middleware/auth');

router.post('/', protect, sendEmail);
router.get('/inbox', protect, getInbox);
router.get('/sent', protect, getSent);
router.get('/:id', protect, getEmail);

module.exports = router;

