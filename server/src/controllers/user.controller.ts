import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/user.repository';
import { boardMemberRepository } from '../repositories/boardMember.repository';

export class UserController {
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, boardId } = req.query;
      const currentUserId = req.user!.id;
      
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        res.status(200).json([]);
        return;
      }

      const excludeUserIds = [currentUserId];

      if (boardId && typeof boardId === 'string') {
        const members = await boardMemberRepository.findMembersByBoardId(boardId);
        members.forEach(m => excludeUserIds.push(m.userId));
      }

      const users = await userRepository.searchUsers(q.trim(), excludeUserIds);
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
