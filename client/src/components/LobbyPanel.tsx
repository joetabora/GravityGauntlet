import type { LobbyPlayer } from '../types';

const AVATAR_GLYPHS: Record<string, string> = {
  triangle: '▲',
  diamond: '◆',
  square: '■',
  hex: '⬡',
  star: '✶',
};

interface LobbyPanelProps {
  lobby: LobbyPlayer[];
  playerId?: string;
}

export function LobbyPanel({ lobby, playerId }: LobbyPanelProps) {
  return (
    <div className="lobby-panel">
      <h2>Lobby</h2>
      <ul>
        {lobby.map((player) => (
          <li key={player.id} className={player.id === playerId ? 'self' : ''}>
            <span className="avatar-tag">
              {AVATAR_GLYPHS[player.avatar] ?? player.avatar.slice(0, 1).toUpperCase()}
            </span>
            <span className="lobby-name">{player.name}</span>
            <span className="lobby-wins">{player.wins} wins</span>
            <span className={`lobby-status ${player.status}`}>{player.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

