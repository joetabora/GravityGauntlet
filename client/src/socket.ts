import { io, Socket } from 'socket.io-client';
import type { AvatarType, GameSnapshot, LobbyPlayer } from './types';

const SERVER_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) ||
  'http://localhost:4000';

interface JoinedPayload {
  playerId: string;
  color: string;
  avatar: AvatarType;
  arena: { width: number; height: number };
}

interface ServerToClientEvents {
  joined: (payload: JoinedPayload) => void;
  'state:update': (payload: GameSnapshot) => void;
  'lobby:update': (payload: LobbyPlayer[]) => void;
  error: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
  'player:input': (payload: { thrustX: number; thrustY: number }) => void;
}

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketRef: GameSocket | null = null;

export const connectSocket = (name: string) =>
  new Promise<{ socket: GameSocket; joined: JoinedPayload }>((resolve, reject) => {
    if (socketRef && socketRef.connected) {
      reject(new Error('Socket already connected.'));
      return;
    }

    const socket: GameSocket = io(SERVER_URL, {
      query: { name },
      transports: ['websocket'],
    });

    const cleanup = () => {
      socket.off('connect_error');
      socket.off('disconnect');
    };

    socket.once('connect_error', (err) => {
      cleanup();
      reject(err);
    });

    socket.once('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.once('joined', (payload) => {
      cleanup();
      socketRef = socket;
      resolve({ socket, joined: payload });
    });
  });

export const getSocket = () => socketRef;

