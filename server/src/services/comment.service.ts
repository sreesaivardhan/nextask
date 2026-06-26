import { commentRepository } from '../repositories/comment.repository';
import { activityLogService } from './activityLog.service';
import { boardRepository } from '../repositories/board.repository';
import { Comment } from '@prisma/client';

export class CommentService {
  async getComments(cardId: string, boardId: string, userId: string): Promise<Comment[]> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }
    return commentRepository.findByCardId(cardId);
  }

  async createComment(cardId: string, boardId: string, userId: string, body: string): Promise<Comment> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

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
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

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
