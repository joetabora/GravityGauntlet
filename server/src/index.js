const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { GravityGauntletGame } = require('./game');

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const clientDistPath = path.join(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const game = new GravityGauntletGame(io);

io.on('connection', (socket) => {
  const { name } = socket.handshake.query;
  const playerName = typeof name === 'string' ? name.trim().slice(0, 24) : '';

  if (!playerName) {
    socket.emit('error', { message: 'Name is required to join.' });
    socket.disconnect(true);
    return;
  }

  const player = game.addPlayer(socket, playerName);

  socket.emit('joined', {
    playerId: player.id,
    color: player.color,
    avatar: player.avatar,
    arena: game.getArena(),
  });

  socket.on('player:input', (input) => {
    game.handleInput(player.id, input);
  });

  socket.on('disconnect', () => {
    game.removePlayer(player.id);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Gravity Gauntlet server running on port ${PORT}`);
});

