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

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async getMember(boardId: string, userId: string) {
    return prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      include: { user: { select: { id: true, displayName: true, email: true } } }
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async addMember(boardId: string, userId: string, role: import('@prisma/client').BoardRole) {
    return prisma.boardMember.create({
      data: { boardId, userId, role },
      include: { user: { select: { id: true, displayName: true, email: true } } }
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async updateRole(boardId: string, userId: string, role: import('@prisma/client').BoardRole) {
    return prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId } },
      data: { role },
      include: { user: { select: { id: true, displayName: true, email: true } } }
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async removeMember(boardId: string, userId: string) {
    return prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId } }
    });
  }
}

export const boardMemberRepository = new BoardMemberRepository();
