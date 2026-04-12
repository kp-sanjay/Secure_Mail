const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

const users = new Map(); // Map userId -> socketId

module.exports = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: No token provided'));
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = await User.findById(decoded.id).select('-password');
      
      if (!socket.user) return next(new Error('Authentication error: User not found'));
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userIdStr = socket.user._id.toString();
    console.log(`[Socket] User connected: ${socket.user.email} (${socket.id})`);
    
    // Register user socket
    users.set(userIdStr, socket.id);
    io.emit('user-online', userIdStr);

    // Fetch initial chat history helper
    socket.on('get-chat-history', async (data) => {
      try {
        const { contactId } = data;
        const messages = await Message.find({
          $or: [
            { sender: socket.user._id, receiver: contactId },
            { sender: contactId, receiver: socket.user._id },
          ]
        }).sort({ timestamp: 1 }).populate('sender', 'name email').populate('receiver', 'name email');
        
        socket.emit('chat-history', messages);
      } catch (err) {
        console.error('[Socket] Get chat history error:', err);
      }
    });

    // Handle personal messages
    socket.on('send-message', async (data) => {
      try {
        const { receiverId, encryptedPayload, ivB64 } = data;
        
        // Save to Database
        const message = await Message.create({
          sender: socket.user._id,
          receiver: receiverId,
          encryptedPayload,
          ivB64,
          timestamp: new Date()
        });

        // Re-fetch with populated fields to mirror the chat history payload
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email')
          .populate('receiver', 'name email');

        // Route to receiver if online
        const receiverSocketId = users.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive-message', populatedMessage);
        }
        
        // Ack back to sender so UI updates
        socket.emit('message-sent', populatedMessage);
      } catch (err) {
        console.error('[Socket] Send message error:', err);
      }
    });

    /* ==========================================================
       WebRTC Signaling (Secret Call)
       ========================================================== */
    socket.on('call-user', (data) => {
      const { userToCall, signalData, name, audioOnly } = data;
      const receiverSocketId = users.get(userToCall);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call-incoming', {
          signal: signalData,
          from: socket.user._id,
          name: name || socket.user.name,
          audioOnly
        });
      } else {
        socket.emit('call-rejected', { reason: 'User offline' });
      }
    });

    socket.on('answer-call', (data) => {
      const { to, signal } = data;
      const callerSocketId = users.get(to);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-accepted', signal);
      }
    });
    
    socket.on('end-call', (data) => {
      const { to } = data;
      const otherSocket = users.get(to);
      if (otherSocket) {
        io.to(otherSocket).emit('call-ended');
      }
    });

    socket.on('reject-call', (data) => {
      const { to } = data;
      const otherSocket = users.get(to);
      if (otherSocket) {
        io.to(otherSocket).emit('call-rejected', { reason: 'User declined the call.' });
      }
    });

    /* ========================================================== */

    socket.on('disconnect', () => {
      users.delete(userIdStr);
      io.emit('user-offline', userIdStr);
      console.log(`[Socket] User disconnected: ${socket.user.email}`);
    });
  });
};
