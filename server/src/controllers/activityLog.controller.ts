import { Request, Response, NextFunction } from 'express';
import { activityLogService } from '../services/activityLog.service';
import { boardRepository } from '../repositories/board.repository';

export class ActivityLogController {
  async getHistoryForCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { cardId } = req.params;
      const boardId = req.query.boardId as string;

      if (!boardId) {
        res.status(400).json({ error: 'boardId is required' });
        return;
      }

      const hasAccess = await boardRepository.isMember(boardId, userId);
      if (!hasAccess) {
        res.status(403).json({ error: 'Unauthorized access to board' });
        return;
      }

      const history = await activityLogService.getHistoryForCard(cardId);
      res.status(200).json(history);
    } catch (error) {
      next(error);
    }
  }
}

export const activityLogController = new ActivityLogController();
