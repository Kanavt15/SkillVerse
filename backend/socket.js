const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initialize Socket.io on the given HTTP server.
 */
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Authenticate and join user-specific room
        socket.on('authenticate', (token) => {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                    issuer: 'skillverse',
                    audience: 'skillverse-client'
                });
                const userId = decoded.id;
                socket.join(`user_${userId}`);
                socket.userId = userId;
                console.log(`🔐 Socket ${socket.id} authenticated as user ${userId}`);
                socket.emit('authenticated', { userId });
            } catch (error) {
                console.error(`❌ Socket auth failed: ${error.message}`);
                socket.emit('auth_error', { message: 'Authentication failed' });
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
        });
    });

    return io;
}

/**
 * Get the Socket.io instance.
 */
function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized. Call initSocket first.');
    }
    return io;
}

/**
 * Emit an event to a specific user by their userId.
 */
function emitToUser(userId, event, data) {
    if (!io) return;
    io.to(`user_${userId}`).emit(event, data);
}

module.exports = { initSocket, getIO, emitToUser };
