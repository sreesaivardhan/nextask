import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { sessionMiddleware } from '../config/session';

let io: SocketServer | null = null;

export function initializeSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.clientUrls,
      credentials: true,
    },
  });

  // Share the Express session middleware with Socket.io so we can read
  // session.userId on every connected socket.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  io.engine.use((req: any, res: any, next: any) => sessionMiddleware(req, res, next));

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── Auto-join user-specific room ──────────────────────────────────────────
    // This allows the dashboard (which is not in any board room) to receive
    // board:created / board:updated / board:deleted events addressed to the user.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId: string | undefined = (socket.request as any).session?.userId;
    if (userId) {
      void socket.join(`user:${userId}`);
      console.log(`[Socket] ${socket.id} auto-joined user room: user:${userId}`);
    }

    // ── Board room management ─────────────────────────────────────────────────
    socket.on('board:join', ({ boardId }: { boardId: string }) => {
      void socket.join(boardId);
      console.log(`[Socket] ${socket.id} joined board room: ${boardId}`);
    });

    socket.on('board:leave', ({ boardId }: { boardId: string }) => {
      void socket.leave(boardId);
      console.log(`[Socket] ${socket.id} left board room: ${boardId}`);
    });

    // ── Live typing ───────────────────────────────────────────────────────────
    // Never persisted. Broadcast only to room, excluding sender.
    socket.on('card:typing', ({ boardId, cardId, displayName }: { boardId: string; cardId: string; displayName: string }) => {
      socket.to(boardId).emit('card:typing', { cardId, displayName });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} — reason: ${reason}`);
    });
  });

  return io;
}

/** Returns the singleton io instance. Throws if called before initializeSocket(). */
export function getIO(): SocketServer {
  if (!io) {
    throw new Error('[Socket] SocketServer not initialised. Call initializeSocket() first.');
  }
  return io;
}
