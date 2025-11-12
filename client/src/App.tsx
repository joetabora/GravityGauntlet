import { useCallback, useEffect, useRef } from 'react';
import './App.css';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { LobbyPanel } from './components/LobbyPanel';
import { LoginScreen } from './components/LoginScreen';
import { audioManager } from './audio/AudioManager';
import { getSocket } from './socket';
import { useGameStore } from './store/gameStore';

function App() {
  const joinGame = useGameStore((state) => state.joinGame);
  const sendInput = useGameStore((state) => state.sendInput);
  const snapshot = useGameStore((state) => state.snapshot);
  const lobby = useGameStore((state) => state.lobby);
  const playerId = useGameStore((state) => state.playerId);
  const arena = useGameStore((state) => state.arena);
  const connected = useGameStore((state) => state.connected);
  const connecting = useGameStore((state) => state.connecting);
  const error = useGameStore((state) => state.error);
  const resetError = useGameStore((state) => state.resetError);

  useEffect(() => {
    if (!connected) {
      return;
    }

    audioManager.startMusic();
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      return undefined;
    }
    const pressed = new Set<string>();

    const emitInput = () => {
      let x = 0;
      let y = 0;
      if (pressed.has('ArrowLeft') || pressed.has('KeyA')) x -= 1;
      if (pressed.has('ArrowRight') || pressed.has('KeyD')) x += 1;
      if (pressed.has('ArrowUp') || pressed.has('KeyW')) y -= 1;
      if (pressed.has('ArrowDown') || pressed.has('KeyS')) y += 1;
      const length = Math.hypot(x, y);
      if (length > 0) {
        x /= length;
        y /= length;
      }
      sendInput(x, y);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(
          event.code,
        )
      ) {
        pressed.add(event.code);
        emitInput();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(
          event.code,
        )
      ) {
        pressed.delete(event.code);
        emitInput();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      sendInput(0, 0);
    };
  }, [connected, sendInput]);

  const handleJoin = useCallback(
    async (name: string) => {
      resetError();
      await audioManager.unlock();
      await joinGame(name);
    },
    [joinGame, resetError],
  );

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!connected) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      return;
    }

    const socket = getSocket();
    if (!socket) {
      return;
    }

    const onJoined = () => {
      const pressed = new Set<string>();
      let frame: number | null = null;

      const emitInput = () => {
        let x = 0;
        let y = 0;
        if (pressed.has('ArrowLeft') || pressed.has('KeyA')) x -= 1;
        if (pressed.has('ArrowRight') || pressed.has('KeyD')) x += 1;
        if (pressed.has('ArrowUp') || pressed.has('KeyW')) y -= 1;
        if (pressed.has('ArrowDown') || pressed.has('KeyS')) y += 1;
        const length = Math.hypot(x, y);
        if (length > 0) {
          x /= length;
          y /= length;
        }
        sendInput(x, y);
      };

      const loop = () => {
        emitInput();
        frame = requestAnimationFrame(loop);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.repeat) return;
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(
            event.code,
          )
        ) {
          pressed.add(event.code);
          if (frame === null) {
            frame = requestAnimationFrame(loop);
          }
        }
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(
            event.code,
          )
        ) {
          pressed.delete(event.code);
          if (pressed.size === 0 && frame !== null) {
            cancelAnimationFrame(frame);
            frame = null;
            sendInput(0, 0);
          }
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      frame = requestAnimationFrame(loop);

      cleanupRef.current = () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        if (frame !== null) {
          cancelAnimationFrame(frame);
        }
        sendInput(0, 0);
      };
    };

    socket.once('joined', onJoined);
    if (playerId) {
      onJoined();
    }

    return () => {
      socket.off('joined', onJoined);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [connected, playerId, sendInput]);
  return (
    <div className={`app ${connected ? 'connected' : 'waiting'}`}>
      {!connected && (
        <LoginScreen onSubmit={handleJoin} loading={connecting} error={error} />
      )}
      {connected && (
        <div className="game-shell">
          <div className="left-panel">
            <LobbyPanel lobby={lobby} playerId={playerId} />
          </div>
          <div className="center-stage">
            <GameCanvas snapshot={snapshot} arena={arena} playerId={playerId} />
            <HUD snapshot={snapshot} playerId={playerId} />
          </div>
          <div className="right-panel">
            <div className="legend">
              <h3>Power-Ups</h3>
              <ul>
                <li>
                  <span className="badge shield" /> Shield — temporary collision immunity.
                </li>
                <li>
                  <span className="badge gravity" /> Gravity Reversal — flips the gauntlet for 3s.
                </li>
                <li>
                  <span className="badge speed" /> Speed Boost — hyper thrusters for 5s.
                </li>
              </ul>
              <h3>Objective</h3>
              <p>Be the last orb floating. Collisions hurt, neon traps slow, power-ups save you.</p>
            </div>
          </div>
        </div>
      )}
      {connected && error && <div className="error-toast">{error}</div>}
    </div>
  );
}

export default App;
