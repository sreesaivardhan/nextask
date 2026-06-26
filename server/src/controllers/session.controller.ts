import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/session.service';

export class SessionController {
  async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== 'string') {
        res.status(400).json({ error: 'Display name is required and must be a string' });
        return;
      }

      const user = await sessionService.createUser(displayName);
      const session = await sessionService.createSession(user.id);

      req.session.sessionId = session.id;
      req.session.userId = user.id;

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Display name')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.session?.sessionId;
      if (!sessionId) {
        res.status(200).json(null);
        return;
      }

      const user = await sessionService.validateSession(sessionId);
      if (!user) {
        res.status(200).json(null);
        return;
      }

      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.session?.sessionId;
      if (sessionId) {
        await sessionService.deleteSession(sessionId);
      }

      req.session.destroy((err) => {
        if (err) {
          next(err);
          return;
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Session deleted' });
      });
    } catch (error) {
      next(error);
    }
  }
}

export const sessionController = new SessionController();
