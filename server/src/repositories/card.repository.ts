import { prisma } from '../utils/prisma';
import { Card } from '@prisma/client';

export class CardRepository {
  async findAllByBoardId(boardId: string): Promise<Card[]> {
    return prisma.card.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });
  }

  async findById(cardId: string): Promise<Card | null> {
    return prisma.card.findUnique({
      where: { id: cardId },
    });
  }

  async create(data: {
    boardId: string;
    columnId: string;
    title: string;
    position: number;
    description?: string | null;
    complexity?: number | null;
    assigneeId?: string | null;
  }): Promise<Card> {
    return prisma.card.create({
      data: {
        boardId: data.boardId,
        columnId: data.columnId,
        title: data.title,
        position: data.position,
        description: data.description,
        complexity: data.complexity,
        assigneeId: data.assigneeId,
        version: 1,
      },
    });
  }

  async update(cardId: string, currentVersion: number, data: {
    title?: string;
    description?: string | null;
    complexity?: number | null;
    assigneeId?: string | null;
    lastEditedByUserId?: string;
  }): Promise<Card> {
    // This uses Prisma's atomic update to ensure the version matches. If version matches, we increment it.
    // However, Prisma doesn't throw a unique error for where clause failing to find a record except recordNotFound.
    // So we use where: { id: cardId, version: currentVersion }. If no row updated, it throws P2025.
    return prisma.card.update({
      where: { id: cardId, version: currentVersion },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  }

  async move(cardId: string, currentVersion: number, data: {
    columnId: string;
    position: number;
    lastEditedByUserId?: string;
  }): Promise<Card> {
    return prisma.card.update({
      where: { id: cardId, version: currentVersion },
      data: {
        columnId: data.columnId,
        position: data.position,
        lastEditedByUserId: data.lastEditedByUserId,
        version: { increment: 1 },
      },
    });
  }

  async delete(cardId: string): Promise<void> {
    await prisma.card.delete({
      where: { id: cardId },
    });
  }

  async getMaxPosition(columnId: string): Promise<number> {
    const result = await prisma.card.aggregate({
      where: { columnId },
      _max: { position: true },
    });
    return result._max.position || 0;
  }
}

export const cardRepository = new CardRepository();
