import { useState } from 'react';

interface LoginScreenProps {
  onSubmit: (name: string) => void;
  loading: boolean;
  error?: string;
}

export function LoginScreen({ onSubmit, loading, error }: LoginScreenProps) {
  const [name, setName] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="login-screen">
      <div className="login-panel">
        <h1>Gravity Gauntlet</h1>
        <p className="tagline">Retro zero-g chaos for neon gladiators.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="player-name">Pilot Name</label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            disabled={loading}
            placeholder="Enter your callsign"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Connecting…' : 'Enter the Gauntlet'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="instructions">
          <span>Controls</span>
          <p>Use WASD or arrow keys for thrusters. Avoid obstacles, collect power-ups, survive!</p>
        </div>
      </div>
    </div>
  );
}



