import { boardRepository } from '../repositories/board.repository';
import { Board } from '@prisma/client';

export class BoardService {
  async getBoards(userId: string): Promise<Board[]> {
    return boardRepository.findAllByUserId(userId);
  }

  async getBoardById(boardId: string, userId: string): Promise<Board> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }
    const board = await boardRepository.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }
    return board;
  }

  async createBoard(userId: string, name: string): Promise<Board> {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error('Invalid board name');
    }
    return boardRepository.create(userId, { name: trimmedName });
  }

  async updateBoard(boardId: string, userId: string, name: string): Promise<Board> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error('Invalid board name');
    }

    return boardRepository.update(boardId, { name: trimmedName });
  }

  async deleteBoard(boardId: string, userId: string): Promise<void> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    await boardRepository.delete(boardId);
  }

  async getAIInsights(boardId: string, userId: string): Promise<import('@prisma/client').AIInsight[]> {
    // Validate access
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const insights = await boardRepository.findAIInsights(boardId);
    return insights;
  }
}

export const boardService = new BoardService();
