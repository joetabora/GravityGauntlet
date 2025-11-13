# Gravity Gauntlet Server

Multiplayer browser game server built with Node.js, Express, and Socket.io.

## Prerequisites

- Node.js 18.x or higher
- npm (comes with Node.js)

## Local Development

### 1. Install Dependencies

```bash
cd server
npm install
```

This will install all required packages including:
- `express` - Web server framework
- `socket.io` - Real-time WebSocket communication
- `cors` - Cross-Origin Resource Sharing middleware
- `dotenv` - Environment variable management

### 2. Set Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cp .env.example .env
```

Edit `.env` and set your variables:

```env
PORT=3000
NODE_ENV=development
```

### 3. Build the Frontend (Required for Production)

Before running the server in production mode, build the React frontend:

```bash
cd ../client
npm install
npm run build
cd ../server
```

This creates the `client/dist` folder that the server serves in production.

### 4. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on port 3000 (or whatever you set in `PORT`).

### 5. Verify It's Working

- Health check: Open `http://localhost:3000/` in your browser - you should see "OK"
- JSON health check: Open `http://localhost:3000/health` - you should see `{"ok": true}`

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Port number for the server | `3000` | No |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` | No |

## Project Structure

```
server/
├── src/
│   ├── index.js    # Main server file (Express app, Socket.io setup)
│   └── game.js     # Game logic (physics, collisions, power-ups)
├── package.json    # Dependencies and scripts
├── .env.example    # Example environment variables
└── README.md       # This file
```

## How It Works

1. **Express Server**: Handles HTTP requests and serves the frontend in production
2. **Socket.io**: Enables real-time bidirectional communication between clients and server
3. **Game Logic**: The `GravityGauntletGame` class manages:
   - Player positions and movements
   - Physics simulation (gravity, collisions, friction)
   - Power-ups and obstacles
   - Round management and leaderboard

## Deployment on Render

1. Push your code to GitHub
2. Connect your repository to Render
3. Render will automatically detect `render.yaml` and deploy the service
4. Set environment variables in the Render dashboard if needed
5. The server will be available at `https://your-service.onrender.com`

For more details, see the `render.yaml` file in the repository root.

## Troubleshooting

**Port already in use:**
- Change `PORT` in `.env` to a different number (e.g., `3001`)
- Or stop the process using port 3000

**Frontend not loading in production:**
- Make sure you've built the frontend (`cd client && npm run build`)
- Check that `client/dist` folder exists

**Socket.io connection errors:**
- Make sure CORS is configured correctly
- Check that the frontend is connecting to the correct server URL
- Verify firewall/network settings aren't blocking WebSocket connections

## License

ISC

