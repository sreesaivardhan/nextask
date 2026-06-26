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

  async updateBoard(boardId: string, userId: string, data: { name?: string; sprintEndDate?: Date | null; complexityMax?: number | null }): Promise<Board> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const updateData: { name?: string; sprintEndDate?: Date | null; complexityMax?: number | null } = {};
    
    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName || trimmedName.length > 100) {
        throw new Error('Invalid board name');
      }
      updateData.name = trimmedName;
    }

    if (data.sprintEndDate !== undefined) {
      updateData.sprintEndDate = data.sprintEndDate;
    }

    if (data.complexityMax !== undefined) {
      if (data.complexityMax !== null && (data.complexityMax < 1 || data.complexityMax > 10 || !Number.isInteger(data.complexityMax))) {
        throw new Error('Invalid complexity threshold. Must be an integer between 1 and 10.');
      }
      updateData.complexityMax = data.complexityMax;
    }

    return boardRepository.update(boardId, updateData);
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
