// Load environment variables from .env file (if it exists)
// This allows us to configure the server without hardcoding values
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { GravityGauntletGame } = require('./game');

// Get port from environment variable, or default to 3000 for Render compatibility
// Render will automatically set PORT when deploying
const PORT = process.env.PORT || 3000;

// Create Express application
// Express handles HTTP requests and responses
const app = express();

// Enable CORS (Cross-Origin Resource Sharing)
// This allows the React frontend (running on a different port in development) to connect
app.use(cors());

// Health check endpoints - MUST be defined BEFORE static file serving
// Render uses these to verify the server is running
// These routes will always work, even in production mode

// Health check endpoint - Returns JSON with status
// Render uses this for monitoring (configure healthCheckPath: /health in render.yaml)
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Root endpoint - Simple health check for development
// In production, the catch-all route below will serve the React app instead
// This route only runs in development mode
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req, res) => {
    // In development, return OK since frontend runs on separate port (Vite dev server)
    res.send('OK');
  });
}

// In production, serve the built React frontend from the client/dist folder
// This allows the server to serve both the API and the frontend from the same port
const clientDistPath = path.join(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production') {
  // Serve static files (JS, CSS, images) from the dist folder
  // This middleware serves files like /assets/index.js, /assets/index.css, etc.
  // Express processes middleware and routes in order, so /health is checked before this
  app.use(express.static(clientDistPath));
  
  // Catch-all route for React Router - serves index.html for any route
  // This allows React Router to handle client-side routing (e.g., /game, /lobby)
  // Note: /health endpoint is already handled above, so health checks won't reach here
  // This catch-all handles / (root) and all other routes, serving the React app
  // IMPORTANT: Express 5+ no longer supports '*' wildcard syntax in route paths
  // Use app.use() without a path parameter to create a catch-all middleware
  app.use((req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Create HTTP server from Express app
// Socket.io needs the raw HTTP server, not just the Express app
const httpServer = http.createServer(app);

// Initialize Socket.io server
// Socket.io enables real-time bidirectional communication between client and server
// We configure CORS to allow connections from any origin (in production, you might want to restrict this)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

// Create the game instance
// The GravityGauntletGame class handles all game logic, physics, and state management
const game = new GravityGauntletGame(io);

// Handle new WebSocket connections
// When a player connects from the browser, this event fires
io.on('connection', (socket) => {
  // Get player name from query parameters
  // The client sends the name when establishing the connection
  const { name } = socket.handshake.query;
  const playerName = typeof name === 'string' ? name.trim().slice(0, 24) : '';

  // Validate that a name was provided
  // If no name, reject the connection and disconnect
  if (!playerName) {
    socket.emit('error', { message: 'Name is required to join.' });
    socket.disconnect(true);
    return;
  }

  // Add the player to the game
  // This creates a player object with position, velocity, color, etc.
  const player = game.addPlayer(socket, playerName);

  // Send initial game state to the newly connected player
  // This includes their player ID, color, avatar, and arena dimensions
  socket.emit('joined', {
    playerId: player.id,
    color: player.color,
    avatar: player.avatar,
    arena: game.getArena(),
  });

  // Handle player input (thruster controls)
  // The client sends input continuously when arrow keys or WASD are pressed
  socket.on('player:input', (input) => {
    game.handleInput(player.id, input);
  });

  // Handle player disconnection
  // When a player closes their browser or loses connection, remove them from the game
  socket.on('disconnect', () => {
    game.removePlayer(player.id);
  });
});

// Start the server and listen on the specified port
// Once this runs, the server is accepting connections
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Gravity Gauntlet server running on port ${PORT}`);
});

