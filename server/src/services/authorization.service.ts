import { boardMemberRepository } from '../repositories/boardMember.repository';
import { BoardRole } from '@prisma/client';

export class AuthorizationService {
  async requireBoardRole(boardId: string, userId: string, allowedRoles: BoardRole[]): Promise<void> {
    const member = await boardMemberRepository.getMember(boardId, userId);
    if (!member) {
      throw new Error('Unauthorized access to board');
    }
    if (!allowedRoles.includes(member.role as BoardRole)) {
      throw new Error('Unauthorized access to board');
    }
  }

  async getMemberRole(boardId: string, userId: string): Promise<BoardRole | null> {
    const member = await boardMemberRepository.getMember(boardId, userId);
    return member ? (member.role as BoardRole) : null;
  }
}

export const authzService = new AuthorizationService();
