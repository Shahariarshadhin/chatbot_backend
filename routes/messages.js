const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Get message history for a specific user
router.get('/user/:userId', messageController.getUserMessages);

// Get all messages (for admin)
router.get('/all', messageController.getAllMessages);

// Get conversation between two users
router.get('/conversation/:userId1/:userId2', messageController.getConversation);

// Delete messages (admin only)
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;

