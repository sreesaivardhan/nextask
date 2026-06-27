import { Request, Response, NextFunction } from 'express';
import { boardMemberService } from '../services/boardMember.service';
import { getIO } from '../socket';

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

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { boardId } = req.params;
      const { userId, role } = req.body;
      const member = await boardMemberService.addMember(boardId, req.user!.id, userId, role);
      res.status(201).json(member);
      getIO().to(boardId).emit('board:members_updated', { boardId });
      getIO().to(`user:${userId}`).emit('board:membership_changed', { action: 'added', boardId });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) res.status(403).json({ error: error.message });
      else if (error instanceof Error) res.status(400).json({ error: error.message });
      else next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { boardId, userId } = req.params;
      const { role } = req.body;
      const member = await boardMemberService.updateRole(boardId, req.user!.id, userId, role);
      res.status(200).json(member);
      getIO().to(boardId).emit('board:members_updated', { boardId });
      getIO().to(`user:${userId}`).emit('board:membership_changed', { action: 'updated', boardId });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) res.status(403).json({ error: error.message });
      else if (error instanceof Error) res.status(400).json({ error: error.message });
      else next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { boardId, userId } = req.params;
      await boardMemberService.removeMember(boardId, req.user!.id, userId);
      res.status(204).send();
      getIO().to(boardId).emit('board:members_updated', { boardId });
      getIO().to(`user:${userId}`).emit('board:membership_changed', { action: 'removed', boardId });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) res.status(403).json({ error: error.message });
      else if (error instanceof Error) res.status(400).json({ error: error.message });
      else next(error);
    }
  }

  async leaveBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { boardId } = req.params;
      await boardMemberService.leaveBoard(boardId, req.user!.id);
      res.status(204).send();
      getIO().to(boardId).emit('board:members_updated', { boardId });
      getIO().to(`user:${req.user!.id}`).emit('board:membership_changed', { action: 'left', boardId });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) res.status(403).json({ error: error.message });
      else if (error instanceof Error) res.status(400).json({ error: error.message });
      else next(error);
    }
  }
}

export const boardMemberController = new BoardMemberController();
