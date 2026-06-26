import { prisma } from '../utils/prisma';
import { ActivityLog } from '@prisma/client';

export class ActivityLogRepository {
  async create(data: {
    boardId: string;
    userId: string | null;
    type: string;
    entityType: string;
    entityId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }): Promise<ActivityLog> {
    return prisma.activityLog.create({
      data: {
        boardId: data.boardId,
        userId: data.userId,
        type: data.type,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
      },
    });
  }

  async findByEntityId(entityId: string): Promise<ActivityLog[]> {
    return prisma.activityLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true } },
      },
    });
  }
}

export const activityLogRepository = new ActivityLogRepository();
