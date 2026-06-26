import { Router } from 'express';
import { activityLogController } from '../controllers/activityLog.controller';
import { requireSession } from '../middleware/auth';

// Root level /api
export const activityLogRouter = Router({ mergeParams: true });

activityLogRouter.use(requireSession);

// GET /api/cards/:cardId/activity
activityLogRouter.get('/cards/:cardId/activity', activityLogController.getHistoryForCard);
