const User = require('../models/User');

class UserController {
  // Find user by ID
  async findUserById(userId) {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error) {
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  // Create a new user
  async createUser(userData) {
    try {
      const { userId, userName, userType } = userData;
      
      const user = await User.create({
        _id: userId,
        userName: userName || `User_${userId.substring(0, 8)}`,
        userType: userType || 'user'
      });

      return user;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Find or create user
  async findOrCreateUser(userData) {
    try {
      let user = await this.findUserById(userData.userId);
      
      if (!user) {
        user = await this.createUser(userData);
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to find or create user: ${error.message}`);
    }
  }

  // Update user last seen
  async updateLastSeen(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Failed to update last seen:', error);
    }
  }
}

module.exports = new UserController();

