import { boardMemberRepository, BoardMemberWithUser } from '../repositories/boardMember.repository';
import { authzService } from './authorization.service';
import { BoardRole } from '@prisma/client';

export class BoardMemberService {
  async getMembers(boardId: string, userId: string): Promise<BoardMemberWithUser[]> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    return boardMemberRepository.findMembersByBoardId(boardId);
  }

  async addMember(boardId: string, requesterId: string, targetUserId: string, role: BoardRole) {
    await authzService.requireBoardRole(boardId, requesterId, ['OWNER', 'ADMIN']);
    const existing = await authzService.getMemberRole(boardId, targetUserId);
    if (existing) throw new Error('User is already a member');
    if (role === 'OWNER') throw new Error('Cannot add a new OWNER');
    return boardMemberRepository.addMember(boardId, targetUserId, role);
  }

  async updateRole(boardId: string, requesterId: string, targetUserId: string, newRole: BoardRole) {
    const requesterRole = await authzService.getMemberRole(boardId, requesterId);
    if (!requesterRole || !['OWNER', 'ADMIN'].includes(requesterRole)) {
      throw new Error('Unauthorized access to board');
    }
    const targetRole = await authzService.getMemberRole(boardId, targetUserId);
    if (!targetRole) throw new Error('Member not found');
    if (newRole === 'OWNER') throw new Error('Cannot promote to OWNER');
    if (targetRole === 'OWNER') throw new Error('Cannot modify the OWNER');
    if (requesterRole === 'ADMIN' && targetRole === 'ADMIN') throw new Error('ADMIN cannot modify another ADMIN');
    return boardMemberRepository.updateRole(boardId, targetUserId, newRole);
  }

  async removeMember(boardId: string, requesterId: string, targetUserId: string) {
    const requesterRole = await authzService.getMemberRole(boardId, requesterId);
    if (!requesterRole || !['OWNER', 'ADMIN'].includes(requesterRole)) {
      throw new Error('Unauthorized access to board');
    }
    const targetRole = await authzService.getMemberRole(boardId, targetUserId);
    if (!targetRole) throw new Error('Member not found');
    if (targetRole === 'OWNER') throw new Error('Cannot remove the OWNER');
    if (requesterRole === 'ADMIN' && targetRole === 'ADMIN') throw new Error('ADMIN cannot remove another ADMIN');
    return boardMemberRepository.removeMember(boardId, targetUserId);
  }

  async leaveBoard(boardId: string, userId: string) {
    const role = await authzService.getMemberRole(boardId, userId);
    if (!role) throw new Error('Member not found');
    if (role === 'OWNER') throw new Error('Owner cannot leave the board. Transfer ownership first.');
    return boardMemberRepository.removeMember(boardId, userId);
  }
}

export const boardMemberService = new BoardMemberService();
