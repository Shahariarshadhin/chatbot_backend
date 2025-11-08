const userController = require('./userController');
const messageController = require('./messageController');

class SocketController {
  constructor(io, activeUsers, userSockets) {
    this.io = io;
    this.activeUsers = activeUsers;
    this.userSockets = userSockets;
  }

  // Handle user joining chat
  async handleJoinChat(socket, data) {
    try {
      const { userId, userName, userType } = data;
      
      // Create or find user
      const user = await userController.findOrCreateUser({
        userId,
        userName,
        userType
      });

      // Determine chat room
      const chatRoom = userType === 'admin' || userType === 'support' 
        ? 'admin-room' 
        : `user-${userId}`;

      socket.join(chatRoom);
      
      // Admin/support automatically joins all existing user rooms
      if (userType === 'admin' || userType === 'support') {
        const existingUsers = Array.from(this.activeUsers.values())
          .filter(u => u.userType !== 'admin' && u.userType !== 'support');
        existingUsers.forEach(u => {
          socket.join(u.chatRoom);
        });
      }
      
      // Store active user info
      this.activeUsers.set(socket.id, {
        userId,
        userName: user.userName,
        userType: user.userType,
        chatRoom,
        socketId: socket.id
      });

      // Store user socket mapping (only for regular users)
      if (userType !== 'admin' && userType !== 'support') {
        this.userSockets.set(userId, socket.id);
      }

      // Notify admin about new user connection and let admin join this user's room
      if (userType !== 'admin' && userType !== 'support') {
        // Let all admins/support join this new user's room
        const admins = Array.from(this.activeUsers.values())
          .filter(u => u.userType === 'admin' || u.userType === 'support');
        admins.forEach(admin => {
          this.io.sockets.sockets.get(admin.socketId)?.join(`user-${userId}`);
        });

        this.io.to('admin-room').emit('new-user-online', {
          userId,
          userName: user.userName,
          timestamp: new Date()
        });
      }

      // Send online users list to admin
      const onlineUsers = Array.from(this.activeUsers.values())
        .filter(u => u.userType !== 'admin' && u.userType !== 'support')
        .map(u => ({
          userId: u.userId,
          userName: u.userName,
          chatRoom: u.chatRoom
        }));
      
      this.io.to('admin-room').emit('online-users', onlineUsers);

      // Send join confirmation
      socket.emit('joined-chat', {
        message: 'Successfully joined chat',
        chatRoom,
        user: {
          userId: user._id,
          userName: user.userName,
          userType: user.userType
        }
      });

      // Load message history
      if (userType === 'admin' || userType === 'support') {
        // For admin: Load all messages from all users
        const allMessages = await messageController.getAllMessagesForAdmin();
        socket.emit('message-history', allMessages);
      } else {
        // For regular users: Load only their messages
        const messages = await messageController.getUserMessageHistory(userId);
        socket.emit('message-history', messages);
      }
    } catch (error) {
      console.error('Error in handleJoinChat:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  }

  // Handle incoming messages
  async handleSendMessage(socket, data) {
    try {
      const { toUserId } = data;
      const userInfo = this.activeUsers.get(socket.id);

      if (!userInfo) {
        socket.emit('error', { message: 'You must join chat first' });
        return;
      }

      // Create message in database first
      const newMessage = await messageController.createMessage({
        userId: userInfo.userId,
        userName: userInfo.userName,
        message: data.message,
        userType: userInfo.userType,
        toUserId: toUserId || null
      });

      console.log('💾 Message saved to database:', newMessage);

      // Send confirmation to sender immediately
      socket.emit('new-message', newMessage);

      // Determine target room and emit
      if (userInfo.userType === 'admin' || userInfo.userType === 'support') {
        // Admin/support sends to specific user
        const targetRoom = `user-${toUserId}`;
        this.io.to(targetRoom).emit('new-message', newMessage);
        console.log(`📤 Admin message sent to room: ${targetRoom}`);
      } else {
        // User sends to admin room - emit to all admins
        this.io.to('admin-room').emit('new-message', newMessage);
        console.log('📤 User message sent to admin-room');
        
        // Also send to user's own room for consistency
        this.io.to(`user-${userInfo.userId}`).emit('new-message', newMessage);
        
        // Notify admin about new message
        this.io.to('admin-room').emit('user-message-notification', {
          userId: userInfo.userId,
          userName: userInfo.userName,
          message: newMessage
        });
      }

      console.log(`✅ Message delivered successfully from ${userInfo.userName}`);
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  // Handle typing indicator
  handleTyping(socket, data) {
    const userInfo = this.activeUsers.get(socket.id);
    if (!userInfo) return;

    let targetRoom;
    if (userInfo.userType === 'admin' || userInfo.userType === 'support') {
      targetRoom = `user-${data.toUserId}`;
    } else {
      targetRoom = 'admin-room';
    }

    socket.to(targetRoom).emit('typing', {
      userId: userInfo.userId,
      userName: userInfo.userName,
      isTyping: data.isTyping
    });
  }

  // Handle admin joining specific user chat
  async handleAdminJoinUserChat(socket, data) {
    try {
      const { userId } = data;
      const userInfo = this.activeUsers.get(socket.id);
      
      if (userInfo && (userInfo.userType === 'admin' || userInfo.userType === 'support')) {
        const userRoom = `user-${userId}`;
        socket.join(userRoom);
        
        // Load conversation history for this specific user
        const messages = await messageController.getUserMessageHistory(userId);
        socket.emit('user-chat-history', { userId, messages });
        
        socket.emit('joined-user-chat', { userId, room: userRoom });
      }
    } catch (error) {
      console.error('Error in handleAdminJoinUserChat:', error);
      socket.emit('error', { message: 'Failed to join user chat' });
    }
  }

  // Handle user disconnect
  handleDisconnect(socket) {
    const userInfo = this.activeUsers.get(socket.id);
    
    if (userInfo) {
      console.log('🔌 Client disconnected:', userInfo.userName);
      
      // Remove from active users
      this.activeUsers.delete(socket.id);
      
      if (userInfo.userType !== 'admin' && userInfo.userType !== 'support') {
        this.userSockets.delete(userInfo.userId);
        
        // Update user's last seen
        userController.updateLastSeen(userInfo.userId);
        
        // Notify admin about user going offline
        this.io.to('admin-room').emit('user-offline', {
          userId: userInfo.userId,
          userName: userInfo.userName,
          timestamp: new Date()
        });

        // Update online users list
        const onlineUsers = Array.from(this.activeUsers.values())
          .filter(u => u.userType !== 'admin' && u.userType !== 'support')
          .map(u => ({
            userId: u.userId,
            userName: u.userName,
            chatRoom: u.chatRoom
          }));
        
        this.io.to('admin-room').emit('online-users', onlineUsers);
      }
    }
  }

  // Initialize socket connection
  initializeSocket(socket) {
    console.log('🔌 New client connected:', socket.id);

    // Register event handlers
    socket.on('join-chat', (data) => this.handleJoinChat(socket, data));
    socket.on('send-message', (data) => this.handleSendMessage(socket, data));
    socket.on('typing', (data) => this.handleTyping(socket, data));
    socket.on('admin-join-user-chat', (data) => this.handleAdminJoinUserChat(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }
}

module.exports = SocketController;