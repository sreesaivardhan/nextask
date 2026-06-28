import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';

export const getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.session!.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const analytics = await analyticsService.getDashboardAnalytics(boardId, userId);
    res.json(analytics);
  } catch (error: unknown) {
    console.error('[Analytics] getDashboardAnalytics error:', error);
    let statusCode = 500;
    let errorMessage = 'Failed to fetch dashboard analytics';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message === 'Board not found') {
        statusCode = 404;
      } else if (error.message.includes('Unauthorized')) {
        statusCode = 403;
      }
    }
    res.status(statusCode).json({ error: errorMessage });
  }
};

export const getTeamAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.session!.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const analytics = await analyticsService.getTeamAnalytics(boardId, userId);
    res.json(analytics);
  } catch (error: unknown) {
    console.error('[Analytics] getTeamAnalytics error:', error);
    let statusCode = 500;
    let errorMessage = 'Failed to fetch team analytics';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message === 'Board not found') {
        statusCode = 404;
      } else if (error.message.includes('Unauthorized')) {
        statusCode = 403;
      }
    }
    res.status(statusCode).json({ error: errorMessage });
  }
};
