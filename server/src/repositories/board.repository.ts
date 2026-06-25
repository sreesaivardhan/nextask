import { prisma } from '../utils/prisma';
import { Board } from '@prisma/client';

export class BoardRepository {
  async findAllByUserId(userId: string): Promise<Board[]> {
    return prisma.board.findMany({
      where: {
        members: { some: { userId } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(boardId: string): Promise<Board | null> {
    return prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          orderBy: { position: 'asc' }
        }
      }
    });
  }

  async create(userId: string, data: { name: string; complexityMax?: number | null; sprintEndDate?: Date | null }): Promise<Board> {
    return prisma.board.create({
      data: {
        name: data.name,
        complexityMax: data.complexityMax ?? 5,
        sprintEndDate: data.sprintEndDate,
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'OWNER'
          }
        }
      }
    });
  }

  async update(boardId: string, data: { name?: string; complexityMax?: number | null; sprintEndDate?: Date | null }): Promise<Board> {
    return prisma.board.update({
      where: { id: boardId },
      data
    });
  }

  async delete(boardId: string): Promise<void> {
    await prisma.board.delete({
      where: { id: boardId }
    });
  }

  async isMember(boardId: string, userId: string): Promise<boolean> {
    const member = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } }
    });
    return !!member;
  }
}

export const boardRepository = new BoardRepository();
