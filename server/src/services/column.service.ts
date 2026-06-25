import { columnRepository } from '../repositories/column.repository';
import { boardRepository } from '../repositories/board.repository';
import { Column } from '@prisma/client';

export class ColumnService {
  async getColumns(boardId: string, userId: string): Promise<Column[]> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }
    return columnRepository.findAllByBoardId(boardId);
  }

  async createColumn(boardId: string, userId: string, name: string): Promise<Column> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error('Invalid column name');
    }

    const maxPos = await columnRepository.getMaxPosition(boardId);
    return columnRepository.create(boardId, trimmedName, maxPos + 65535);
  }

  async updateColumn(boardId: string, columnId: string, userId: string, name: string): Promise<Column> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const column = await columnRepository.findById(columnId);
    if (!column || column.boardId !== boardId) {
      throw new Error('Column not found');
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error('Invalid column name');
    }

    return columnRepository.update(columnId, { name: trimmedName });
  }

  async deleteColumn(boardId: string, columnId: string, userId: string): Promise<void> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const column = await columnRepository.findById(columnId);
    if (!column || column.boardId !== boardId) {
      throw new Error('Column not found');
    }

    await columnRepository.delete(columnId);
  }

  async reorderColumn(boardId: string, columnId: string, userId: string, newPosition: number): Promise<Column> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const column = await columnRepository.findById(columnId);
    if (!column || column.boardId !== boardId) {
      throw new Error('Column not found');
    }

    return columnRepository.update(columnId, { position: newPosition });
  }
}

export const columnService = new ColumnService();
