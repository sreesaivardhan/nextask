import { prisma } from '../utils/prisma';
import { Comment } from '@prisma/client';

export class CommentRepository {
  async findByCardId(cardId: string): Promise<Comment[]> {
    return prisma.comment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' }, // Newest comment last
      include: {
        user: { select: { id: true, displayName: true } },
      },
    });
  }

  async create(cardId: string, userId: string, body: string): Promise<Comment> {
    return prisma.comment.create({
      data: { cardId, userId, body },
      include: {
        user: { select: { id: true, displayName: true } },
      },
    });
  }

  async findById(commentId: string): Promise<Comment | null> {
    return prisma.comment.findUnique({ where: { id: commentId } });
  }

  async delete(commentId: string): Promise<void> {
    await prisma.comment.delete({ where: { id: commentId } });
  }
}

export const commentRepository = new CommentRepository();
