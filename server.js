const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('✅ Chatbot Server is Running...');
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Routes and Controllers
const messageRoutes = require('./routes/messages');
const SocketController = require('./controllers/socketController');

// Routes
app.use('/api/messages', messageRoutes);

// Store active connections
const activeUsers = new Map(); // socketId -> {userId, userName, userType, chatRoom}
const userSockets = new Map(); // userId -> socketId

// Initialize Socket Controller
const socketController = new SocketController(io, activeUsers, userSockets);

// Socket.io Connection
io.on('connection', (socket) => {
  socketController.initializeSocket(socket);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io server initialized`);
  console.log(`📝 API endpoints available at http://localhost:${PORT}/api`);
});

