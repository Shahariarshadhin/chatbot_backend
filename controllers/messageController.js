const Message = require('../models/Message');

class MessageController {
  // Get message history for a specific user
  async getUserMessages(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 100, skip = 0 } = req.query;

      const messages = await Message.find({
        $or: [
          { userId: userId },
          { toUserId: userId }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

      res.json({
        success: true,
        messages: messages.reverse(),
        count: messages.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all messages (for admin)
  async getAllMessages(req, res) {
    try {
      const { limit = 500, skip = 0 } = req.query;

      const messages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      res.json({
        success: true,
        messages: messages.reverse(),
        count: messages.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get conversation between two users
  async getConversation(req, res) {
    try {
      const { userId1, userId2 } = req.params;

      const messages = await Message.find({
        $or: [
          { userId: userId1, toUserId: userId2 },
          { userId: userId2, toUserId: userId1 },
          { userId: userId1, toUserId: null },
          { userId: userId2, toUserId: null }
        ]
      }).sort({ timestamp: 1 });

      res.json({
        success: true,
        messages,
        count: messages.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Delete a message (admin only)
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      await Message.findByIdAndDelete(messageId);
      
      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create a new message
  async createMessage(data) {
    try {
      const { userId, userName, message, userType, toUserId } = data;
      
      const newMessage = await Message.create({
        userId,
        userName,
        message,
        userType,
        toUserId: toUserId || null,
        timestamp: new Date()
      });

      // Return message with id field for consistency
      return {
        id: newMessage._id.toString(),
        _id: newMessage._id,
        userId: newMessage.userId,
        userName: newMessage.userName,
        message: newMessage.message,
        userType: newMessage.userType,
        toUserId: newMessage.toUserId,
        timestamp: newMessage.timestamp
      };
    } catch (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  // Get messages for a user (for socket events)
  async getUserMessageHistory(userId, limit = 50) {
    try {
      const messages = await Message.find({
        $or: [
          { userId: userId },
          { toUserId: userId }
        ]
      }).sort({ timestamp: 1 }).limit(limit);

      // Return with id field for consistency
      return messages.map(msg => ({
        id: msg._id.toString(),
        _id: msg._id,
        userId: msg.userId,
        userName: msg.userName,
        message: msg.message,
        userType: msg.userType,
        toUserId: msg.toUserId,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      throw new Error(`Failed to get message history: ${error.message}`);
    }
  }

  // Get all messages for admin (for socket events)
  async getAllMessagesForAdmin(limit = 200) {
    try {
      const messages = await Message.find()
        .sort({ timestamp: 1 })
        .limit(limit);

      // Return with id field for consistency
      return messages.map(msg => ({
        id: msg._id.toString(),
        _id: msg._id,
        userId: msg.userId,
        userName: msg.userName,
        message: msg.message,
        userType: msg.userType,
        toUserId: msg.toUserId,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      throw new Error(`Failed to get all messages: ${error.message}`);
    }
  }
}

module.exports = new MessageController();