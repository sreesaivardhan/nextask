import { prisma } from '../utils/prisma';
import { Column } from '@prisma/client';

export class ColumnRepository {
  async findAllByBoardId(boardId: string): Promise<Column[]> {
    return prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' }
    });
  }

  async findById(columnId: string): Promise<Column | null> {
    return prisma.column.findUnique({
      where: { id: columnId }
    });
  }

  async create(boardId: string, name: string, position: number): Promise<Column> {
    return prisma.column.create({
      data: { boardId, name, position }
    });
  }

  async update(columnId: string, data: { name?: string; position?: number }): Promise<Column> {
    return prisma.column.update({
      where: { id: columnId },
      data
    });
  }

  async delete(columnId: string): Promise<void> {
    await prisma.column.delete({
      where: { id: columnId }
    });
  }

  async getMaxPosition(boardId: string): Promise<number> {
    const result = await prisma.column.aggregate({
      where: { boardId },
      _max: { position: true }
    });
    return result._max.position || 0;
  }
}

export const columnRepository = new ColumnRepository();
