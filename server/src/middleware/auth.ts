import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';

export const requireSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.session?.sessionId;
    if (!sessionId) {
      res.status(401).json({ error: 'Unauthorized: No session found' });
      return;
    }

    const user = await sessionService.validateSession(sessionId);
    if (!user) {
      req.session.destroy(() => {});
      res.clearCookie('connect.sid');
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
