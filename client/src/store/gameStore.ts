import { create } from 'zustand';
import { connectSocket, getSocket } from '../socket';
import type {
  GameSnapshot,
  LobbyPlayer,
} from '../types';

interface GameStore {
  name: string;
  playerId?: string;
  arena?: { width: number; height: number };
  lobby: LobbyPlayer[];
  snapshot?: GameSnapshot;
  connecting: boolean;
  connected: boolean;
  error?: string;
  joinGame: (name: string) => Promise<void>;
  sendInput: (thrustX: number, thrustY: number) => void;
  resetError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  name: '',
  playerId: undefined,
  arena: undefined,
  lobby: [],
  snapshot: undefined,
  connecting: false,
  connected: false,
  error: undefined,

  joinGame: async (name: string) => {
    if (get().connecting || get().connected) {
      return;
    }
    set({ connecting: true, error: undefined });
    try {
      const { socket, joined } = await connectSocket(name);

      socket.on('state:update', (payload) => {
        set({ snapshot: payload });
      });

      socket.on('lobby:update', (lobbyPayload) => {
        set({ lobby: lobbyPayload });
      });

      socket.on('error', (payload) => {
        set({ error: payload.message });
      });

      socket.on('disconnect', () => {
        set({ connected: false });
      });

      set({
        name,
        playerId: joined.playerId,
        arena: joined.arena,
        connecting: false,
        connected: true,
      });
    } catch (error) {
      set({
        connecting: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      });
    }
  },

  sendInput: (thrustX: number, thrustY: number) => {
    const socket = getSocket();
    if (!socket || !socket.connected) {
      return;
    }
    socket.emit('player:input', { thrustX, thrustY });
  },

  resetError: () => set({ error: undefined }),
}));

