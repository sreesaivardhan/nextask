import { boardMemberRepository, BoardMemberWithUser } from '../repositories/boardMember.repository';
import { boardRepository } from '../repositories/board.repository';

export class BoardMemberService {
  async getMembers(boardId: string, userId: string): Promise<BoardMemberWithUser[]> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }
    return boardMemberRepository.findMembersByBoardId(boardId);
  }
}

export const boardMemberService = new BoardMemberService();
