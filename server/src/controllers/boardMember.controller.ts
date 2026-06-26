import { Request, Response, NextFunction } from 'express';
import { boardMemberService } from '../services/boardMember.service';

export class BoardMemberController {
  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const members = await boardMemberService.getMembers(boardId, userId);
      res.status(200).json(members);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized access to board') {
        res.status(403).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const boardMemberController = new BoardMemberController();
