import { Request, Response, NextFunction } from 'express';
import { commentService } from '../services/comment.service';
import { getIO } from '../socket/index';

function senderSocketId(req: Request): string | undefined {
  const id = req.headers['x-socket-id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export class CommentController {
  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      const boardId = req.query.boardId as string;

      if (!boardId) {
        res.status(400).json({ error: 'boardId is required' });
        return;
      }

      const comments = await commentService.getComments(cardId, boardId, userId);
      res.status(200).json(comments);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      const { boardId, body } = req.body;

      if (!boardId || !body) {
        res.status(400).json({ error: 'boardId and body are required' });
        return;
      }

      const comment = await commentService.createComment(cardId, boardId, userId, body);
      res.status(201).json(comment);
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId as string).except(socketId) : getIO().to(boardId as string);
      emitter.emit('comment:created', comment);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized access to board') {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === 'Invalid comment body') {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { commentId } = req.params;
      const cardId = (req.query.cardId as string) || req.body.cardId;
      const boardId = (req.query.boardId as string) || req.body.boardId;
      if (!boardId || !cardId) {
        res.status(400).json({ error: 'cardId and boardId are required' });
        return;
      }

      await commentService.deleteComment(commentId, cardId, boardId, userId);
      res.status(204).send();
      const socketId = senderSocketId(req);
      const emitter = socketId ? getIO().to(boardId as string).except(socketId) : getIO().to(boardId as string);
      emitter.emit('comment:deleted', { commentId, cardId });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized access to board') {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message === 'Comment not found') {
          res.status(404).json({ error: error.message });
          return;
        }
      }
      next(error);
    }
  }
}

export const commentController = new CommentController();
