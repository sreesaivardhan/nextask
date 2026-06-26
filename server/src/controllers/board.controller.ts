import { Request, Response, NextFunction } from 'express';
import { boardService } from '../services/board.service';
import { getIO } from '../socket/index';

/** Extract the X-Socket-Id header sent by the client to exclude the sender from broadcasts. */
function senderSocketId(req: Request): string | undefined {
  const id = req.headers['x-socket-id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export class BoardController {
  async getBoards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const boards = await boardService.getBoards(userId);
      res.status(200).json(boards);
    } catch (error) {
      next(error);
    }
  }

  async getBoardById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const board = await boardService.getBoardById(boardId, userId);
      res.status(200).json(board);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Board not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async createBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name } = req.body;
      const board = await boardService.createBoard(userId, name || '');
      res.status(201).json(board);
      // Broadcast to the user's personal room so all their tabs (dashboard, etc.)
      // receive the new board without refresh. Exclude the sender tab.
      const socketId = senderSocketId(req);
      const emitter = socketId
        ? getIO().to(`user:${userId}`).except(socketId)
        : getIO().to(`user:${userId}`);
      emitter.emit('board:created', board);
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid board name') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async updateBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const { name, sprintEndDate, complexityMax } = req.body;
      
      let parsedDate: Date | null | undefined = undefined;
      if (sprintEndDate !== undefined) {
        if (sprintEndDate === null) {
          parsedDate = null;
        } else {
          parsedDate = new Date(sprintEndDate);
          if (isNaN(parsedDate.getTime())) {
            res.status(400).json({ error: 'Invalid sprint end date' });
            return;
          }
        }
      }

      const board = await boardService.updateBoard(boardId, userId, { 
        name, 
        sprintEndDate: parsedDate, 
        complexityMax 
      });
      res.status(200).json(board);
      // Broadcast to board room (members viewing the board) AND user room (dashboard).
      const socketId = senderSocketId(req);
      const io = getIO();
      const rooms = [boardId, `user:${userId}`];
      rooms.forEach((room) => {
        const emitter = socketId ? io.to(room).except(socketId) : io.to(room);
        emitter.emit('board:updated', board);
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Invalid board name') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async deleteBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      await boardService.deleteBoard(boardId, userId);
      res.status(204).send();
      const socketId = senderSocketId(req);
      const io = getIO();
      const rooms = [boardId, `user:${userId}`];
      rooms.forEach((room) => {
        const emitter = socketId ? io.to(room).except(socketId) : io.to(room);
        emitter.emit('board:deleted', { boardId });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
  async getAIInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const insights = await boardService.getAIInsights(boardId, userId);
      res.status(200).json(insights);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const boardController = new BoardController();
