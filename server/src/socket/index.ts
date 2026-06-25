import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from '../config/env';

export function initializeSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('board:join', ({ boardId }: { boardId: string }) => {
      void socket.join(boardId);
      console.log(`[Socket] ${socket.id} joined board room: ${boardId}`);
    });

    socket.on('board:leave', ({ boardId }: { boardId: string }) => {
      void socket.leave(boardId);
      console.log(`[Socket] ${socket.id} left board room: ${boardId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} — reason: ${reason}`);
    });
  });

  return io;
}
