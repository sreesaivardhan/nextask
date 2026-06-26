import { Request, Response, NextFunction } from 'express';
import { columnService } from '../services/column.service';
import { getIO } from '../socket/index';

function senderSocketId(req: Request): string | undefined {
  const id = req.headers['x-socket-id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export class ColumnController {
  async getColumns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const columns = await columnService.getColumns(boardId, userId);
      res.status(200).json(columns);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async createColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const { name } = req.body;
      const column = await columnService.createColumn(boardId, userId, name || '');
      res.status(201).json(column);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId).except(socketId) : getIO().to(boardId);
      emitter.emit('column:created', column);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Invalid column name') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async updateColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId, columnId } = req.params;
      const { name } = req.body;
      const column = await columnService.updateColumn(boardId, columnId, userId, name || '');
      res.status(200).json(column);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId).except(socketId) : getIO().to(boardId);
      emitter.emit('column:updated', column);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Column not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Invalid column name') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async deleteColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId, columnId } = req.params;
      await columnService.deleteColumn(boardId, columnId, userId);
      res.status(204).send();
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId).except(socketId) : getIO().to(boardId);
      emitter.emit('column:deleted', { columnId });
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Column not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async reorderColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId, columnId } = req.params;
      const { position } = req.body;
      
      if (typeof position !== 'number') {
        res.status(400).json({ error: 'Position must be a number' });
        return;
      }

      const column = await columnService.reorderColumn(boardId, columnId, userId, position);
      res.status(200).json(column);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId).except(socketId) : getIO().to(boardId);
      emitter.emit('column:moved', column);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === 'Column not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const columnController = new ColumnController();
