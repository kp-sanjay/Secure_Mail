const express = require('express');
const router = express.Router();
const {
  sendEmail,
  getInbox,
  getSent,
  getEmail,
  saveDraft,
  getDrafts,
  deleteDraft,
  searchEmails,
  getThread,
  updateEmailCategory,
} = require('../controllers/emailController');
const { protect } = require('../middleware/auth');

router.post('/', protect, sendEmail);
router.get('/inbox', protect, getInbox);
router.get('/sent', protect, getSent);
router.get('/drafts', protect, getDrafts);
router.post('/draft', protect, saveDraft);
router.delete('/draft/:id', protect, deleteDraft);
router.get('/search', protect, searchEmails);
router.get('/thread/:threadId', protect, getThread);
router.put('/:id/category', protect, updateEmailCategory);
router.get('/:id', protect, getEmail);

module.exports = router;

