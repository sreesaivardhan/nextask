import { activityLogRepository } from '../repositories/activityLog.repository';
import { ActivityLog } from '@prisma/client';
import { getIO } from '../socket/index';

export class ActivityLogService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async log(boardId: string, userId: string | null, type: string, entityType: string, entityId: string, metadata?: any): Promise<ActivityLog> {
    const log = await activityLogRepository.create({
      boardId,
      userId,
      type,
      entityType,
      entityId,
      metadata,
    });

    // Broadcast to all board room members immediately after persistence
    try {
      getIO().to(boardId).emit('activity:created', log);
    } catch {
      // Socket may not be initialized in test environments — silently ignore
    }

    return log;
  }

  async getHistoryForCard(cardId: string): Promise<ActivityLog[]> {
    return activityLogRepository.findByEntityId(cardId);
  }
}

export const activityLogService = new ActivityLogService();
