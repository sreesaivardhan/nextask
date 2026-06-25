import { Request, Response, NextFunction } from 'express';
import { boardService } from '../services/board.service';

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
      const { name } = req.body;
      const board = await boardService.updateBoard(boardId, userId, name || '');
      res.status(200).json(board);
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
