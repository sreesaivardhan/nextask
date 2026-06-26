/**
 * Singleton Socket.io client.
 *
 * Guarantees:
 *  - Exactly ONE socket instance for the entire browser tab lifetime.
 *  - Connects explicitly to the backend URL — never to the Vite dev server.
 *  - Connects only when a valid session exists (called from sessionStore).
 *  - Disconnects on logout.
 *  - joinBoard() is idempotent: a socket never joins the same room twice per connection.
 *  - Board room is automatically rejoined after reconnect.
 */
import { io, Socket } from 'socket.io-client';

const BACKEND_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private currentBoardId: string | null = null;

  /**
   * Set of board IDs already joined on the current connection.
   * Cleared on every disconnect so rooms are rejoined fresh after reconnect.
   */
  private joinedBoards = new Set<string>();

  connect(): Socket {
    // True singleton: if an instance already exists, never recreate it.
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return this.socket;
    }

    this.socket = io(BACKEND_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket!.id);
      // Rejoin the current board room after reconnect.
      // joinedBoards was cleared on disconnect, so the join will go through.
      if (this.currentBoardId) {
        this._emitJoin(this.currentBoardId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      // Clear the joined set so rooms are properly rejoined on next connect.
      this.joinedBoards.clear();
    });



    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentBoardId = null;
      this.joinedBoards.clear();
    }
  }

  /**
   * Join a board room. Idempotent — the same board will not be joined twice per
   * connection. This prevents React StrictMode's double-effect from causing
   * duplicate "joined board room" server logs.
   */
  joinBoard(boardId: string): void {
    this.currentBoardId = boardId;
    this._emitJoin(boardId);
  }

  leaveBoard(boardId: string): void {
    if (this.currentBoardId === boardId) {
      this.currentBoardId = null;
    }
    this.joinedBoards.delete(boardId);
    const s = this.socket;
    if (s && s.connected) {
      s.emit('board:leave', { boardId });
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  /** Emit typing event for a card. Never persisted. */
  emitTyping(boardId: string, cardId: string, displayName: string): void {
    const s = this.socket;
    if (s && s.connected) {
      s.emit('card:typing', { boardId, cardId, displayName });
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _emitJoin(boardId: string): void {
    if (this.joinedBoards.has(boardId)) return; // Already joined on this connection
    const s = this.socket;
    if (!s || !s.connected) return;
    this.joinedBoards.add(boardId);
    s.emit('board:join', { boardId });
  }
}

export const socketService = new SocketService();
