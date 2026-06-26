import { prisma } from '../utils/prisma';

export interface BoardMemberWithUser {
  boardId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  user: { id: string; displayName: string };
}

export class BoardMemberRepository {
  async findMembersByBoardId(boardId: string): Promise<BoardMemberWithUser[]> {
    return prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: { select: { id: true, displayName: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }) as unknown as BoardMemberWithUser[];
  }
}

export const boardMemberRepository = new BoardMemberRepository();
