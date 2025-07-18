import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import server components
import SessionHandler from './handlers/SessionHandler.js';
import PlayerHandler from './handlers/PlayerHandler.js';
import GameEventHandler from './handlers/GameEventHandler.js';
import MatchmakingManager from './managers/MatchmakingManager.js';
import { Logger } from './monitoring/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000", "http://localhost:5173", "http://localhost:4000"],
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

// Initialize managers
const matchmakingManager = new MatchmakingManager();
const logger = new Logger();

// Initialize handlers
const sessionHandler = new SessionHandler(io, matchmakingManager, logger);
const playerHandler = new PlayerHandler(io, sessionHandler, logger);
const gameEventHandler = new GameEventHandler(io, sessionHandler, logger);

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    // Register event handlers
    playerHandler.registerEvents(socket);
    sessionHandler.registerEvents(socket);
    gameEventHandler.registerEvents(socket);
    
    socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        playerHandler.handleDisconnect(socket);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        activeSessions: sessionHandler.getActiveSessionCount(),
        connectedPlayers: playerHandler.getConnectedPlayerCount()
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.json({
        sessions: sessionHandler.getSessionMetrics(),
        players: playerHandler.getPlayerMetrics(),
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        }
    });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    logger.info(`Tower Defense Server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info(`Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

export { app, server, io }; 