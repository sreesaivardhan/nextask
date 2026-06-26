import { Request, Response, NextFunction } from 'express';
import { cardService } from '../services/card.service';
import { getIO } from '../socket/index';

function senderSocketId(req: Request): string | undefined {
  const id = req.headers['x-socket-id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export class CardController {
  async getCards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const cards = await cardService.getCards(boardId, userId);
      res.status(200).json(cards);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async createCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId, columnId, title, description, complexity, assigneeId } = req.body;
      const card = await cardService.createCard(boardId, columnId, userId, {
        title,
        description,
        complexity,
        assigneeId,
      });
      res.status(201).json(card);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId as string).except(socketId) : getIO().to(boardId as string);
      emitter.emit('card:created', card);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized access to board') {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.startsWith('Invalid') || error.message.startsWith('Description') || error.message.startsWith('Assignee')) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error.message === 'Column not found') {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async updateCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { version, title, description, complexity, assigneeId } = req.body;

      if (version === undefined) {
        res.status(400).json({ error: 'Version is required for updates' });
        return;
      }

      const card = await cardService.updateCard(id, userId, version, {
        title,
        description,
        complexity,
        assigneeId,
      });
      res.status(200).json(card);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(card.boardId).except(socketId) : getIO().to(card.boardId);
      emitter.emit('card:updated', card);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized access to board') {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.startsWith('Version conflict')) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message === 'Card not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.startsWith('Invalid') || error.message.startsWith('Description') || error.message.startsWith('Assignee')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async moveCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { version, columnId, position } = req.body;

      if (version === undefined || !columnId || position === undefined) {
        res.status(400).json({ error: 'Version, columnId, and position are required' });
        return;
      }

      const card = await cardService.moveCard(id, userId, version, { columnId, position });
      res.status(200).json(card);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(card.boardId).except(socketId) : getIO().to(card.boardId);
      emitter.emit('card:moved', card);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized access to board') {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.startsWith('Version conflict')) {
          res.status(409).json({ error: error.message });
          return;
        }
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async deleteCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      // Fetch card before deletion to get boardId/columnId for the broadcast
      const card = await cardService.findCardById(id);
      const boardId = card?.boardId;
      const columnId = card?.columnId;
      await cardService.deleteCard(id, userId);
      res.status(204).send();
      if (boardId) {
        const socketId = senderSocketId(req);
        const emitter = socketId ? getIO().to(boardId).except(socketId) : getIO().to(boardId);
        emitter.emit('card:deleted', { cardId: id, columnId });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized access to board') {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === 'Card not found') {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}

export const cardController = new CardController();
