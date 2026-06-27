import { commentRepository } from '../repositories/comment.repository';
import { activityLogService } from './activityLog.service';
import { Comment } from '@prisma/client';
import { authzService } from './authorization.service';

export class CommentService {
  async getComments(cardId: string, boardId: string, userId: string): Promise<Comment[]> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    return commentRepository.findByCardId(cardId);
  }

  async createComment(cardId: string, boardId: string, userId: string, body: string): Promise<Comment> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

    const trimmedBody = body.trim();
    if (!trimmedBody || trimmedBody.length > 1000) {
      throw new Error('Invalid comment body');
    }

    const comment = await commentRepository.create(cardId, userId, trimmedBody);

    // Automatically create ActivityLog entry
    await activityLogService.log(boardId, userId, 'COMMENT_ADDED', 'Card', cardId, { commentId: comment.id, body: trimmedBody });

    return comment;
  }

  async deleteComment(commentId: string, cardId: string, boardId: string, userId: string): Promise<void> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

    const comment = await commentRepository.findById(commentId);
    if (!comment || comment.cardId !== cardId) {
      throw new Error('Comment not found');
    }

    // Usually only author can delete, but let's allow it as we don't have strict roles defined for comments deletion in prompt.
    // The prompt: "Comments belong to cards. Use existing session user."
    await commentRepository.delete(commentId);
  }
}

export const commentService = new CommentService();
