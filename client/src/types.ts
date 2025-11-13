export type GamePhase = 'waiting' | 'countdown' | 'playing' | 'round_over';

export interface Vector2 {
  x: number;
  y: number;
}

export type AvatarType = 'triangle' | 'diamond' | 'square' | 'hex' | 'star';

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  avatar: AvatarType;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  health: number;
  wins: number;
  status: 'waiting' | 'alive' | 'eliminated';
  effects: {
    shield: number;
    speedBoost: number;
    slow: number;
  };
}

export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  avatar: AvatarType;
  wins: number;
  status: string;
}

export interface MovingWallObstacle {
  id: string;
  type: 'moving-wall';
  position: Vector2;
  width: number;
  height: number;
  velocity: Vector2;
}

export interface LaserObstacle {
  id: string;
  type: 'laser';
  origin: Vector2;
  radius: number;
  angle: number;
  angularVelocity: number;
  width: number;
}

export type Obstacle = MovingWallObstacle | LaserObstacle;

export interface PowerUp {
  id: string;
  type: 'shield' | 'gravity-reversal' | 'speed-boost';
  position: Vector2;
  color: string;
  radius: number;
  pulse: number;
}

export type GameEvent =
  | { type: 'collision'; players: string[]; magnitude: number }
  | { type: 'obstacle-hit'; playerId: string }
  | { type: 'power-up'; playerId: string; power: PowerUp['type'] }
  | { type: 'player-eliminated'; playerId: string }
  | { type: 'round-win'; playerId: string; wins: number }
  | { type: 'round-start' }
  | { type: 'countdown-start'; duration: number }
  | { type: 'gravity-change'; gravity: Vector2 }
  | { type: 'gravity-flip'; playerId: string }
  | { type: 'gravity-revert'; gravity: Vector2 };

export interface GameSnapshot {
  state: GamePhase;
  countdown: number;
  roundOverTimer: number;
  gravity: Vector2;
  gravityTimer: number;
  arena: { width: number; height: number };
  players: PlayerState[];
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  events: GameEvent[];
}



