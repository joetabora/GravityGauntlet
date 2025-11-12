import { useEffect, useRef } from 'react';
import type { GameSnapshot, PlayerState, PowerUp } from '../types';
import { audioManager } from '../audio/AudioManager';

interface GameCanvasProps {
  snapshot?: GameSnapshot;
  arena?: { width: number; height: number };
  playerId?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const GRID_COLOR = 'rgba(0, 255, 255, 0.28)';
const GRID_GLOW = 'rgba(0, 180, 255, 0.65)';
const BACKGROUND_TOP = '#050017';
const BACKGROUND_BOTTOM = '#0a0333';

const findPlayer = (snapshot: GameSnapshot | undefined, id: string | undefined) =>
  snapshot?.players.find((p) => p.id === id);

const createBurst = (player: PlayerState, magnitude: number, storage: Particle[]) => {
  const count = 10 + Math.floor(magnitude * 15);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 120 + 40) * (1 + magnitude * 0.4);
    storage.push({
      x: player.position.x,
      y: player.position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.25,
      color: player.color,
      size: 6 + Math.random() * 6,
    });
  }
};

const createPowerUpGlow = (origin: PowerUp, storage: Particle[]) => {
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    storage.push({
      x: origin.position.x,
      y: origin.position.y,
      vx: Math.cos(angle) * 50,
      vy: Math.sin(angle) * 50,
      life: 0,
      maxLife: 0.6,
      color: origin.color,
      size: 4,
    });
  }
};

const drawAvatar = (
  ctx: CanvasRenderingContext2D,
  type: PlayerState['avatar'],
  x: number,
  y: number,
  size: number,
  color: string,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  switch (type) {
    case 'triangle': {
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(-size, size);
      ctx.closePath();
      break;
    }
    case 'diamond': {
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
      break;
    }
    case 'hex': {
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'star': {
      const spikes = 5;
      const outer = size;
      const inner = size / 2;
      for (let i = 0; i < spikes * 2; i += 1) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (Math.PI / spikes) * i;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default: {
      ctx.rect(-size, -size, size * 2, size * 2);
    }
  }
  ctx.stroke();
  ctx.restore();
};

export function GameCanvas({ snapshot, arena, playerId }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<GameSnapshot | undefined>(snapshot);
  const particlesRef = useRef<Particle[]>([]);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !arena) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let animationFrame = 0;

    const render = (time: number) => {
      const currentSnapshot = snapshotRef.current;
      const dpr = window.devicePixelRatio || 1;
      const width = arena.width;
      const height = arena.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = BACKGROUND_TOP;
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, BACKGROUND_TOP);
      gradient.addColorStop(1, BACKGROUND_BOTTOM);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      drawGrid(ctx, width, height, time);
      updateParticles(ctx, particlesRef.current, delta);

      if (currentSnapshot) {
        drawObstacles(ctx, currentSnapshot.obstacles);
        drawPowerUps(ctx, currentSnapshot.powerUps, time);
        drawPlayers(ctx, currentSnapshot.players, playerId, time);
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrame);
  }, [arena, playerId]);

  useEffect(() => {
    const currentSnapshot = snapshot;
    if (!currentSnapshot) {
      return;
    }
    currentSnapshot.events.forEach((event) => {
      if (event.type === 'collision') {
        event.players.forEach((id) => {
          const player = findPlayer(currentSnapshot, id);
          if (player) {
            createBurst(player, event.magnitude, particlesRef.current);
            audioManager.playCollision(event.magnitude);
          }
        });
      } else if (event.type === 'obstacle-hit') {
        const player = findPlayer(currentSnapshot, event.playerId);
        if (player) {
          createBurst(player, 0.8, particlesRef.current);
        }
      } else if (event.type === 'power-up') {
        const player = findPlayer(currentSnapshot, event.playerId);
        if (player) {
          createPowerUpGlow(
            {
              id: `${event.playerId}-${event.power}`,
              type: event.power,
              position: player.position,
              color: player.color,
              radius: player.radius,
              pulse: 0,
            },
            particlesRef.current,
          );
          audioManager.playPowerUp(event.power);
        }
      } else if (event.type === 'round-win') {
        audioManager.playRoundWin();
      }
    });
  }, [snapshot]);

  return (
    <div className="game-canvas-wrapper">
      <canvas ref={canvasRef} />
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const spacing = 80;
  const offset = Math.sin(time * 0.0006) * spacing * 0.3;
  ctx.save();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.shadowColor = GRID_GLOW;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.7;

  for (let x = -spacing; x <= width + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x - offset, height);
    ctx.stroke();
  }
  for (let y = -spacing; y <= height + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(width, y - offset);
    ctx.stroke();
  }
  ctx.restore();
}

function updateParticles(ctx: CanvasRenderingContext2D, particles: Particle[], delta: number) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life += delta;
    if (particle.life >= particle.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    const lifeRatio = 1 - particle.life / particle.maxLife;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    ctx.save();
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = lifeRatio;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * lifeRatio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  players: PlayerState[],
  playerId: string | undefined,
  time: number,
) {
  players.forEach((player) => {
    const glowPulse = 0.6 + Math.sin(time * 0.004 + player.position.x) * 0.2;
    const radius = player.radius;

    ctx.save();
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = player.color;
    ctx.globalAlpha = player.status === 'eliminated' ? 0.3 : 1;

    const gradient = ctx.createRadialGradient(
      player.position.x,
      player.position.y,
      radius * 0.2,
      player.position.x,
      player.position.y,
      radius * glowPulse,
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, player.color);
    gradient.addColorStop(1, '#000000');
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(player.position.x, player.position.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (player.effects.shield > 0) {
      ctx.strokeStyle = 'rgba(103, 213, 255, 0.9)';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 45;
      ctx.beginPath();
      ctx.arc(player.position.x, player.position.y, radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (player.effects.speedBoost > 0) {
      ctx.strokeStyle = 'rgba(255, 231, 97, 0.8)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(player.position.x, player.position.y, radius + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (player.effects.slow > 0) {
      ctx.strokeStyle = 'rgba(180, 0, 255, 0.4)';
      ctx.lineWidth = 12;
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(player.position.x, player.position.y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Health bar
    const barWidth = radius * 2;
    const barHeight = 6;
    const healthRatio = Math.max(0, Math.min(1, player.health / 100));
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(player.position.x - radius, player.position.y + radius + 12, barWidth, barHeight);
    ctx.fillStyle = playerId === player.id ? '#66ff9c' : '#ff6f61';
    ctx.fillRect(
      player.position.x - radius,
      player.position.y + radius + 12,
      barWidth * healthRatio,
      barHeight,
    );
    ctx.restore();

    // Name + avatar
    ctx.save();
    ctx.font = '12px "Press Start 2P", "Pixel", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillText(player.name, player.position.x, player.position.y - radius - 24);
    drawAvatar(ctx, player.avatar, player.position.x, player.position.y - radius - 36, 8, player.color);
    ctx.restore();
  });
}

function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: GameSnapshot['obstacles']) {
  obstacles.forEach((obstacle) => {
    ctx.save();
    if (obstacle.type === 'moving-wall') {
      ctx.translate(obstacle.position.x, obstacle.position.y);
      ctx.fillStyle = 'rgba(255, 0, 153, 0.75)';
      ctx.shadowColor = '#ff0099';
      ctx.shadowBlur = 30;
      ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
    } else {
      ctx.translate(obstacle.origin.x, obstacle.origin.y);
      ctx.rotate(obstacle.angle);
      ctx.fillStyle = 'rgba(0, 255, 191, 0.6)';
      ctx.shadowColor = '#00ffbf';
      ctx.shadowBlur = 25;
      ctx.fillRect(-obstacle.radius, -obstacle.width / 2, obstacle.radius * 2, obstacle.width);
    }
    ctx.restore();
  });
}

function drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: PowerUp[], time: number) {
  powerUps.forEach((powerUp) => {
    ctx.save();
    const pulse = Math.sin(time * 0.005 + powerUp.pulse) * 0.3 + 0.7;
    const radius = powerUp.radius * 0.7 * pulse;
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = powerUp.color;
    ctx.shadowBlur = 35;
    ctx.fillStyle = powerUp.color;
    ctx.beginPath();
    ctx.arc(powerUp.position.x, powerUp.position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });
}

