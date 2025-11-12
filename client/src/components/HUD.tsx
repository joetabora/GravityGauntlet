import type { GameSnapshot, PlayerState } from '../types';

interface HUDProps {
  snapshot?: GameSnapshot;
  playerId?: string;
}

const formatTimer = (value: number) => value.toFixed(1);

const gravityToArrow = (gravity?: { x: number; y: number }) => {
  if (!gravity) return '·';
  const { x, y } = gravity;
  const threshold = 0.4 * Math.max(Math.abs(x), Math.abs(y));
  const horizontal = Math.abs(x) > threshold ? (x > 0 ? '→' : '←') : '';
  const vertical = Math.abs(y) > threshold ? (y > 0 ? '↓' : '↑') : '';
  const combined = vertical + horizontal;
  return combined || '·';
};

const getPlayerById = (snapshot: GameSnapshot | undefined, id: string | undefined) =>
  snapshot?.players.find((player) => player.id === id);

const getActiveEffects = (player: PlayerState | undefined) => {
  if (!player) return [];
  const effects: { label: string; duration: number }[] = [];
  if (player.effects.shield > 0) {
    effects.push({ label: 'Shield', duration: player.effects.shield });
  }
  if (player.effects.speedBoost > 0) {
    effects.push({ label: 'Speed Boost', duration: player.effects.speedBoost });
  }
  if (player.effects.slow > 0) {
    effects.push({ label: 'Slowed', duration: player.effects.slow });
  }
  return effects;
};

export function HUD({ snapshot, playerId }: HUDProps) {
  const player = getPlayerById(snapshot, playerId);
  const effects = getActiveEffects(player);

  return (
    <div className="hud">
      <div className="hud-row top">
        <div className="hud-card">
          <span className="label">Gravity</span>
          <span className="value arrow">{gravityToArrow(snapshot?.gravity)}</span>
          {snapshot && (
            <span className="sub">
              Next shift in {formatTimer(Math.max(0, snapshot.gravityTimer))}s
            </span>
          )}
        </div>
        <div className="hud-card centre">
          {snapshot?.state === 'countdown' && (
            <span className="countdown">Round begins in {Math.ceil(snapshot.countdown)}</span>
          )}
          {snapshot?.state === 'waiting' && (
            <span className="status">Waiting for players (need 2 to start)</span>
          )}
          {snapshot?.state === 'round_over' && (
            <span className="status">
              Next round in {Math.ceil(Math.max(0, snapshot.roundOverTimer))}s
            </span>
          )}
          {snapshot?.state === 'playing' && (
            <span className="status">Survive the gauntlet!</span>
          )}
        </div>
        <div className="hud-card right">
          <span className="label">Velocity</span>
          {player ? (
            <span className="value">{`${player.velocity.x.toFixed(0)}, ${player.velocity.y.toFixed(
              0,
            )}`}</span>
          ) : (
            <span className="value">0, 0</span>
          )}
          <span className="sub">
            {player ? `Health ${Math.max(0, player.health).toFixed(0)}%` : 'Join to play'}
          </span>
        </div>
      </div>

      <div className="hud-row mid">
        <div className="leaderboard">
          <span className="section-title">Leaderboard</span>
          <div className="leaderboard-grid">
            {snapshot?.players
              .slice()
              .sort((a, b) => b.wins - a.wins)
              .map((entry) => (
                <div
                  key={entry.id}
                  className={`leaderboard-row ${entry.id === playerId ? 'self' : ''} ${
                    entry.status !== 'alive' ? 'inactive' : ''
                  }`}
                >
                  <span className="name">{entry.name}</span>
                  <span className="wins">{entry.wins}</span>
                  <span className={`status ${entry.status}`}>{entry.status}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="effects">
          <span className="section-title">Active Effects</span>
          {effects.length === 0 && <span className="empty">None</span>}
          {effects.map((effect) => (
            <div key={effect.label} className={`effect ${effect.label.replace(/\s+/g, '').toLowerCase()}`}>
              <span className="effect-name">{effect.label}</span>
              <span className="effect-timer">{formatTimer(effect.duration)}s</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


