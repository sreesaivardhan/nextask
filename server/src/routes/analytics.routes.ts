import { Router } from 'express';
import { getDashboardAnalytics, getTeamAnalytics } from '../controllers/analytics.controller';
import { requireSession } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.use(requireSession);

analyticsRouter.get('/boards/:boardId/dashboard', getDashboardAnalytics);
analyticsRouter.get('/boards/:boardId/team', getTeamAnalytics);
