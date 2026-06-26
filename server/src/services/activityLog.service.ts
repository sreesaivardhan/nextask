import { activityLogRepository } from '../repositories/activityLog.repository';
import { ActivityLog } from '@prisma/client';

export class ActivityLogService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async log(boardId: string, userId: string | null, type: string, entityType: string, entityId: string, metadata?: any): Promise<ActivityLog> {
    return activityLogRepository.create({
      boardId,
      userId,
      type,
      entityType,
      entityId,
      metadata,
    });
  }

  async getHistoryForCard(cardId: string): Promise<ActivityLog[]> {
    return activityLogRepository.findByEntityId(cardId);
  }
}

export const activityLogService = new ActivityLogService();
