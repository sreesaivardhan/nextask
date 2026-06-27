import { columnRepository } from '../repositories/column.repository';
import { Column } from '@prisma/client';
import { authzService } from './authorization.service';

export class ColumnService {
  async getColumns(boardId: string, userId: string): Promise<Column[]> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    return columnRepository.findAllByBoardId(boardId);
  }

  async createColumn(boardId: string, userId: string, name: string): Promise<Column> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN']);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 50) {
      throw new Error('Invalid column name');
    }

    const maxPos = await columnRepository.getMaxPosition(boardId);
    const position = maxPos + 65535;

    return columnRepository.create(boardId, trimmedName, position);
  }

  async updateColumn(columnId: string, userId: string, name: string): Promise<Column> {
    const column = await columnRepository.findById(columnId);
    if (!column) {
      throw new Error('Column not found');
    }

    await authzService.requireBoardRole(column.boardId, userId, ['OWNER', 'ADMIN']);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 50) {
      throw new Error('Invalid column name');
    }

    return columnRepository.update(columnId, { name: trimmedName });
  }

  async deleteColumn(columnId: string, userId: string): Promise<void> {
    const column = await columnRepository.findById(columnId);
    if (!column) {
      throw new Error('Column not found');
    }

    await authzService.requireBoardRole(column.boardId, userId, ['OWNER', 'ADMIN']);

    await columnRepository.delete(columnId);
  }

  async reorderColumn(columnId: string, userId: string, position: number): Promise<Column> {
    const column = await columnRepository.findById(columnId);
    if (!column) {
      throw new Error('Column not found');
    }

    await authzService.requireBoardRole(column.boardId, userId, ['OWNER', 'ADMIN']);

    return columnRepository.update(columnId, { position });
  }
}

export const columnService = new ColumnService();
