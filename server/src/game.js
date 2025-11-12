const { randomUUID } = require('crypto');

const ARENA_WIDTH = 1400;
const ARENA_HEIGHT = 800;
const PLAYER_RADIUS = 22;
const PLAYER_BASE_SPEED = 420;
const PLAYER_MAX_SPEED = 440;
const PLAYER_FRICTION = 0.92;
const PLAYER_COLLISION_DAMAGE = 18;
const OBSTACLE_COLLISION_DAMAGE = 30;
const WALL_COLLISION_DAMAGE = 12;
const OBSTACLE_SLOW_DURATION = 2.4; // seconds
const GRAVITY_STRENGTH = 180;
const GRAVITY_MIN_DURATION = 5;
const GRAVITY_MAX_DURATION = 10;
const POWERUP_RADIUS = 26;
const POWERUP_MIN_INTERVAL = 6;
const POWERUP_MAX_INTERVAL = 11;
const OBSTACLE_MIN_INTERVAL = 8;
const OBSTACLE_MAX_INTERVAL = 14;
const ROUND_OVER_DURATION = 5;
const COUNTDOWN_DURATION = 3;

const GRAVITY_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
];

const PLAYER_COLORS = [
  '#4dfcff',
  '#ff71f8',
  '#ffe066',
  '#66ff9c',
  '#ff6f61',
  '#8a7dff',
  '#ffb347',
  '#4ecdc4',
];

const AVATAR_TYPES = ['triangle', 'diamond', 'square', 'hex', 'star'];

const POWER_UP_TYPES = [
  { type: 'shield', color: '#67d5ff' },
  { type: 'gravity-reversal', color: '#ff9bf7' },
  { type: 'speed-boost', color: '#ffe761' },
];

const OBSTACLE_TYPES = ['moving-wall', 'laser'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randRange = (min, max) => Math.random() * (max - min) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

class GravityGauntletGame {
  constructor(io) {
    this.io = io;
    this.players = new Map();
    this.obstacles = [];
    this.powerUps = [];
    this.events = [];
    this.arena = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
    this.state = 'waiting'; // waiting | countdown | playing | round_over
    this.countdownRemaining = 0;
    this.roundOverTimer = 0;
    this.gravity = this.generateGravityVector();
    this.gravityTimer = this.generateGravityDuration();
    this.gravityReversalTimer = 0;
    this.nextObstacleSpawn = this.generateObstacleInterval();
    this.nextPowerUpSpawn = this.generatePowerUpInterval();
    this.broadcastAccumulator = 0;
    this.lastUpdate = Date.now();
    this.avatarCursor = 0;

    this.loop = setInterval(() => this.update(), 1000 / 60);
  }

  addPlayer(socket, name) {
    const existing = this.players.get(socket.id);
    if (existing) {
      return existing;
    }

    const color = choice(PLAYER_COLORS);
    const avatar = AVATAR_TYPES[this.avatarCursor % AVATAR_TYPES.length];
    this.avatarCursor += 1;

    const player = {
      id: socket.id,
      name,
      color,
      avatar,
      position: this.randomSpawnPoint(),
      velocity: { x: 0, y: 0 },
      thrust: { x: 0, y: 0 },
      radius: PLAYER_RADIUS,
      health: 100,
      wins: 0,
      status: 'waiting', // waiting | alive | eliminated | spectating
      effects: {
        shield: 0,
        speedBoost: 0,
        slow: 0,
      },
      joinedAt: Date.now(),
    };

    this.players.set(socket.id, player);
    this.syncLobby();

    if (this.shouldStartCountdown()) {
      this.beginCountdown();
    }

    return player;
  }

  removePlayer(id) {
    if (this.players.has(id)) {
      this.players.delete(id);
    }
    this.syncLobby();

    if (this.state === 'playing' || this.state === 'countdown') {
      const alivePlayers = this.getAlivePlayers();
      if (alivePlayers.length <= 1) {
        this.endRound(alivePlayers[0]);
      }
    }

    if (this.players.size < 2 && (this.state === 'countdown' || this.state === 'playing')) {
      this.state = 'waiting';
      this.countdownRemaining = 0;
    }
  }

  getArena() {
    return this.arena;
  }

  handleInput(id, input) {
    const player = this.players.get(id);
    if (!player || player.status !== 'alive') {
      return;
    }

    const { thrustX = 0, thrustY = 0 } = input || {};
    player.thrust.x = clamp(thrustX, -1, 1);
    player.thrust.y = clamp(thrustY, -1, 1);
  }

  shouldStartCountdown() {
    if (this.state === 'playing' || this.state === 'countdown') {
      return false;
    }
    const connectedPlayers = [...this.players.values()];
    return connectedPlayers.length >= 2;
  }

  beginCountdown() {
    this.state = 'countdown';
    this.countdownRemaining = COUNTDOWN_DURATION;
    for (const player of this.players.values()) {
      player.status = 'waiting';
      player.effects = { shield: 0, speedBoost: 0, slow: 0 };
      player.velocity = { x: 0, y: 0 };
    }
    this.events.push({ type: 'countdown-start', duration: COUNTDOWN_DURATION });
  }

  startRound() {
    this.state = 'playing';
    this.obstacles = [];
    this.powerUps = [];
    this.gravity = this.generateGravityVector();
    this.gravityTimer = this.generateGravityDuration();
    this.gravityReversalTimer = 0;
    this.nextObstacleSpawn = this.generateObstacleInterval();
    this.nextPowerUpSpawn = this.generatePowerUpInterval();

    for (const player of this.players.values()) {
      player.position = this.randomSpawnPoint();
      player.velocity = { x: 0, y: 0 };
      player.thrust = { x: 0, y: 0 };
      player.health = 100;
      player.status = 'alive';
      player.effects = {
        shield: 0,
        speedBoost: 0,
        slow: 0,
      };
    }

    this.events.push({ type: 'round-start' });
  }

  endRound(winner) {
    this.state = 'round_over';
    this.roundOverTimer = ROUND_OVER_DURATION;
    if (winner) {
      winner.wins += 1;
      this.events.push({ type: 'round-win', playerId: winner.id, wins: winner.wins });
    }
    for (const player of this.players.values()) {
      if (player.status === 'alive') {
        player.status = 'waiting';
      }
    }
  }

  getAlivePlayers() {
    return [...this.players.values()].filter((player) => player.status === 'alive');
  }

  syncLobby() {
    const lobby = [...this.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      wins: player.wins,
      status: player.status,
    }));
    this.io.emit('lobby:update', lobby);
  }

  randomSpawnPoint() {
    const padding = PLAYER_RADIUS * 2 + 20;
    return {
      x: randRange(padding, ARENA_WIDTH - padding),
      y: randRange(padding, ARENA_HEIGHT - padding),
    };
  }

  generateObstacleInterval() {
    return randRange(OBSTACLE_MIN_INTERVAL, OBSTACLE_MAX_INTERVAL);
  }

  generatePowerUpInterval() {
    return randRange(POWERUP_MIN_INTERVAL, POWERUP_MAX_INTERVAL);
  }

  generateGravityDuration() {
    return randRange(GRAVITY_MIN_DURATION, GRAVITY_MAX_DURATION);
  }

  generateGravityVector() {
    const dir = choice(GRAVITY_DIRECTIONS);
    return {
      x: dir.x * GRAVITY_STRENGTH,
      y: dir.y * GRAVITY_STRENGTH,
    };
  }

  spawnPowerUp() {
    const template = choice(POWER_UP_TYPES);
    const powerUp = {
      id: randomUUID(),
      type: template.type,
      color: template.color,
      radius: POWERUP_RADIUS,
      position: this.randomSpawnPoint(),
      pulse: Math.random() * Math.PI * 2,
    };
    this.powerUps.push(powerUp);
    this.nextPowerUpSpawn = this.generatePowerUpInterval();
  }

  spawnObstacle() {
    const type = choice(OBSTACLE_TYPES);
    if (type === 'moving-wall') {
      const width = randRange(160, 260);
      const height = randRange(30, 60);
      const direction = Math.random() < 0.5 ? 1 : -1;
      const obstacle = {
        id: randomUUID(),
        type: 'moving-wall',
        position: {
          x: randRange(width / 2 + 80, ARENA_WIDTH - width / 2 - 80),
          y: randRange(height / 2 + 80, ARENA_HEIGHT - height / 2 - 80),
        },
        width,
        height,
        velocity: {
          x: direction * randRange(40, 80),
          y: direction * randRange(40, 80) * (Math.random() < 0.5 ? -1 : 1),
        },
      };
      this.obstacles.push(obstacle);
    } else {
      const radius = randRange(120, 180);
      const obstacle = {
        id: randomUUID(),
        type: 'laser',
        origin: {
          x: randRange(radius + 60, ARENA_WIDTH - radius - 60),
          y: randRange(radius + 60, ARENA_HEIGHT - radius - 60),
        },
        radius,
        angle: Math.random() * Math.PI * 2,
        angularVelocity: randRange(-Math.PI / 6, Math.PI / 6),
        width: randRange(18, 26),
      };
      this.obstacles.push(obstacle);
    }
    this.nextObstacleSpawn = this.generateObstacleInterval();
  }

  applyGravity(player, dt) {
    // The arena is a zero-g field, but we simulate shifting gravity by continuously accelerating
    // every orb in the direction of the current global gravity vector. The magnitude is intentionally
    // gentle so players can counteract it with thrusters, yet strong enough to keep everyone drifting.
    player.velocity.x += (this.gravity.x / PLAYER_BASE_SPEED) * dt * GRAVITY_STRENGTH * 0.2;
    player.velocity.y += (this.gravity.y / PLAYER_BASE_SPEED) * dt * GRAVITY_STRENGTH * 0.2;
  }

  applyThrust(player, dt) {
    const thrustMagnitude = PLAYER_BASE_SPEED * dt;
    player.velocity.x += player.thrust.x * thrustMagnitude;
    player.velocity.y += player.thrust.y * thrustMagnitude;
  }

  applyFriction(player) {
    player.velocity.x *= PLAYER_FRICTION;
    player.velocity.y *= PLAYER_FRICTION;
  }

  applySpeedLimits(player) {
    const speedMultiplier = this.computeSpeedMultiplier(player);
    const maxSpeed = PLAYER_MAX_SPEED * speedMultiplier;
    const speed = Math.hypot(player.velocity.x, player.velocity.y);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      player.velocity.x *= scale;
      player.velocity.y *= scale;
    }
  }

  computeSpeedMultiplier(player) {
    let multiplier = 1;
    if (player.effects.speedBoost > 0) {
      multiplier += 0.6;
    }
    if (player.effects.slow > 0) {
      multiplier -= 0.55;
    }
    return clamp(multiplier, 0.2, 2.2);
  }

  updatePlayerPosition(player, dt) {
    player.position.x += player.velocity.x * dt;
    player.position.y += player.velocity.y * dt;
  }

  handleBoundary(player) {
    const radius = player.radius;

    if (player.position.x < radius) {
      player.position.x = radius;
      player.velocity.x = Math.abs(player.velocity.x) * 0.65;
      this.applyBoundaryDamage(player);
    } else if (player.position.x > ARENA_WIDTH - radius) {
      player.position.x = ARENA_WIDTH - radius;
      player.velocity.x = -Math.abs(player.velocity.x) * 0.65;
      this.applyBoundaryDamage(player);
    }

    if (player.position.y < radius) {
      player.position.y = radius;
      player.velocity.y = Math.abs(player.velocity.y) * 0.65;
      this.applyBoundaryDamage(player);
    } else if (player.position.y > ARENA_HEIGHT - radius) {
      player.position.y = ARENA_HEIGHT - radius;
      player.velocity.y = -Math.abs(player.velocity.y) * 0.65;
      this.applyBoundaryDamage(player);
    }
  }

  applyBoundaryDamage(player) {
    player.health -= WALL_COLLISION_DAMAGE * 0.2;
    if (player.health <= 0) {
      this.eliminatePlayer(player);
    }
  }

  eliminatePlayer(player) {
    if (player.status === 'alive') {
      player.status = 'eliminated';
      player.velocity = { x: 0, y: 0 };
      player.thrust = { x: 0, y: 0 };
      this.events.push({ type: 'player-eliminated', playerId: player.id });
    }
  }

  handlePlayerCollisions() {
    // Resolve player-to-player impacts using a simple elastic collision approximation.
    // We separate overlapping orbs along the collision normal, exchange momentum so the
    // bounce looks reactive, and apply impact damage based on the impulse magnitude.
    const players = [...this.players.values()].filter((p) => p.status === 'alive');
    for (let i = 0; i < players.length; i += 1) {
      const a = players[i];
      for (let j = i + 1; j < players.length; j += 1) {
        const b = players[j];
        if (a.effects.shield > 0 || b.effects.shield > 0) {
          continue;
        }
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          a.position.x -= nx * (overlap / 2);
          a.position.y -= ny * (overlap / 2);
          b.position.x += nx * (overlap / 2);
          b.position.y += ny * (overlap / 2);

          const av = a.velocity.x * nx + a.velocity.y * ny;
          const bv = b.velocity.x * nx + b.velocity.y * ny;
          const momentum = bv - av;

          a.velocity.x += momentum * nx;
          a.velocity.y += momentum * ny;
          b.velocity.x -= momentum * nx;
          b.velocity.y -= momentum * ny;

          const impact = Math.abs(momentum);
          a.health -= PLAYER_COLLISION_DAMAGE * impact;
          b.health -= PLAYER_COLLISION_DAMAGE * impact;

          if (a.health <= 0) {
            this.eliminatePlayer(a);
          }
          if (b.health <= 0) {
            this.eliminatePlayer(b);
          }

          this.events.push({
            type: 'collision',
            players: [a.id, b.id],
            magnitude: impact,
          });
        }
      }
    }
  }

  handleObstacleCollisions(dt) {
    for (const obstacle of this.obstacles) {
      if (obstacle.type === 'moving-wall') {
        obstacle.position.x += obstacle.velocity.x * dt;
        obstacle.position.y += obstacle.velocity.y * dt;

        if (
          obstacle.position.x < obstacle.width / 2 ||
          obstacle.position.x > ARENA_WIDTH - obstacle.width / 2
        ) {
          obstacle.velocity.x *= -1;
        }
        if (
          obstacle.position.y < obstacle.height / 2 ||
          obstacle.position.y > ARENA_HEIGHT - obstacle.height / 2
        ) {
          obstacle.velocity.y *= -1;
        }

        for (const player of this.players.values()) {
          if (player.status !== 'alive' || player.effects.shield > 0) {
            continue;
          }
          if (this.circleRectIntersect(player, obstacle)) {
            this.applyObstacleHit(player);
          }
        }
      } else if (obstacle.type === 'laser') {
        obstacle.angle += obstacle.angularVelocity * dt;
        for (const player of this.players.values()) {
          if (player.status !== 'alive' || player.effects.shield > 0) {
            continue;
          }
          if (this.circleLaserIntersect(player, obstacle)) {
            this.applyObstacleHit(player);
          }
        }
      }
    }
  }

  circleRectIntersect(player, rect) {
    const rectLeft = rect.position.x - rect.width / 2;
    const rectRight = rect.position.x + rect.width / 2;
    const rectTop = rect.position.y - rect.height / 2;
    const rectBottom = rect.position.y + rect.height / 2;
    const closestX = clamp(player.position.x, rectLeft, rectRight);
    const closestY = clamp(player.position.y, rectTop, rectBottom);
    const dx = player.position.x - closestX;
    const dy = player.position.y - closestY;
    return dx * dx + dy * dy < player.radius * player.radius;
  }

  circleLaserIntersect(player, laser) {
    const angle = laser.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const px = player.position.x - laser.origin.x;
    const py = player.position.y - laser.origin.y;
    const localX = px * cos + py * sin;
    const localY = -px * sin + py * cos;
    const halfLength = laser.radius;
    const halfWidth = laser.width / 2 + player.radius;
    return Math.abs(localX) <= halfLength && Math.abs(localY) <= halfWidth;
  }

  applyObstacleHit(player) {
    player.effects.slow = Math.max(player.effects.slow, OBSTACLE_SLOW_DURATION);
    player.health -= OBSTACLE_COLLISION_DAMAGE * 0.6;
    if (player.health <= 0) {
      this.eliminatePlayer(player);
    }
    this.events.push({ type: 'obstacle-hit', playerId: player.id });
  }

  updatePowerUps(dt) {
    for (const powerUp of this.powerUps) {
      powerUp.pulse += dt;
    }

    for (const player of this.players.values()) {
      if (player.status !== 'alive') {
        continue;
      }
      for (let i = this.powerUps.length - 1; i >= 0; i -= 1) {
        const powerUp = this.powerUps[i];
        const dx = player.position.x - powerUp.position.x;
        const dy = player.position.y - powerUp.position.y;
        const distSq = dx * dx + dy * dy;
        const maxDist = player.radius + powerUp.radius * 0.6;
        if (distSq < maxDist * maxDist) {
          this.applyPowerUp(player, powerUp);
          this.powerUps.splice(i, 1);
        }
      }
    }

    this.nextPowerUpSpawn -= dt;
    if (this.nextPowerUpSpawn <= 0) {
      this.spawnPowerUp();
    }
  }

  applyPowerUp(player, powerUp) {
    // Power-ups latch additional timed effects onto the player or arena. Shields gate collisions,
    // gravity reversal flips the global vector temporarily, and speed boost amplifies thruster output.
    if (powerUp.type === 'shield') {
      player.effects.shield = 5;
    } else if (powerUp.type === 'gravity-reversal') {
      this.gravity.x *= -1;
      this.gravity.y *= -1;
      this.gravityReversalTimer = 3;
      this.events.push({ type: 'gravity-flip', playerId: player.id });
    } else if (powerUp.type === 'speed-boost') {
      player.effects.speedBoost = 5;
    }
    this.events.push({ type: 'power-up', playerId: player.id, power: powerUp.type });
  }

  updateEffects(player, dt) {
    if (player.effects.shield > 0) {
      player.effects.shield = Math.max(0, player.effects.shield - dt);
    }
    if (player.effects.speedBoost > 0) {
      player.effects.speedBoost = Math.max(0, player.effects.speedBoost - dt);
    }
    if (player.effects.slow > 0) {
      player.effects.slow = Math.max(0, player.effects.slow - dt);
    }
  }

  update() {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    if (this.state === 'countdown') {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.startRound();
      }
    } else if (this.state === 'round_over') {
      this.roundOverTimer -= dt;
      if (this.roundOverTimer <= 0) {
        if (this.shouldStartCountdown()) {
          this.beginCountdown();
        } else {
          this.state = 'waiting';
        }
      }
    }

    if (this.state === 'playing') {
      this.gravityTimer -= dt;
      if (this.gravityTimer <= 0) {
        this.gravity = this.generateGravityVector();
        this.gravityTimer = this.generateGravityDuration();
        this.events.push({ type: 'gravity-change', gravity: this.gravity });
      }

      if (this.gravityReversalTimer > 0) {
        this.gravityReversalTimer -= dt;
        if (this.gravityReversalTimer <= 0) {
          this.gravity.x *= -1;
          this.gravity.y *= -1;
          this.events.push({ type: 'gravity-revert', gravity: this.gravity });
        }
      }

      this.nextObstacleSpawn -= dt;
      if (this.nextObstacleSpawn <= 0) {
        this.spawnObstacle();
      }

      for (const player of this.players.values()) {
        if (player.status !== 'alive') {
          continue;
        }
        this.updateEffects(player, dt);
        this.applyGravity(player, dt);
        this.applyThrust(player, dt);
        this.applyFriction(player);
        this.applySpeedLimits(player);
        this.updatePlayerPosition(player, dt);
        this.handleBoundary(player);
        if (player.health <= 0) {
          this.eliminatePlayer(player);
        }
      }

      this.handlePlayerCollisions();
      this.handleObstacleCollisions(dt);
      this.updatePowerUps(dt);

      const alivePlayers = this.getAlivePlayers();
      if (alivePlayers.length <= 1) {
        this.endRound(alivePlayers[0]);
      }
    }

    this.broadcastAccumulator += dt;
    if (this.broadcastAccumulator >= 1 / 20) {
      this.broadcastState();
      this.broadcastAccumulator = 0;
      this.events = [];
    }
  }

  broadcastState() {
    const payload = {
      state: this.state,
      countdown: Math.max(0, this.countdownRemaining),
      roundOverTimer: Math.max(0, this.roundOverTimer),
      gravity: this.gravity,
      gravityTimer: Math.max(0, this.gravityTimer),
      arena: this.arena,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        color: player.color,
        avatar: player.avatar,
        position: player.position,
        velocity: player.velocity,
        radius: player.radius,
        health: clamp(player.health, 0, 100),
        wins: player.wins,
        status: player.status,
        effects: player.effects,
      })),
      obstacles: this.obstacles,
      powerUps: this.powerUps,
      events: this.events,
    };

    this.io.emit('state:update', payload);
  }
}

module.exports = { GravityGauntletGame };

