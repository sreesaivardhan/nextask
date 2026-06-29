import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';
import { oauthService } from '../services/oauth.service';
import { AuthProvider } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { displayName, email, password } = req.body;
      if (!displayName || !email || !password) {
        res.status(400).json({ error: 'Display name, email, and password are required' });
        return;
      }

      const { user, session } = await authService.register(displayName, email, password);

      req.session.sessionId = session.id;
      req.session.userId = user.id;

      // Sanitize user
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...sanitizedUser } = user;
      res.status(201).json(sanitizedUser);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Display name') ||
        error.message.includes('Invalid email') ||
        error.message.includes('Password') ||
        error.message.includes('Email is already')
      )) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const { user, session } = await authService.login(email, password);

      req.session.sessionId = session.id;
      req.session.userId = user.id;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...sanitizedUser } = user;
      res.status(200).json(sanitizedUser);
    } catch (error) {
      if (error instanceof Error && (error.message === 'Invalid credentials' || error.message === 'Invalid email or password')) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
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
        res.status(200).json({ message: 'Logged out successfully' });
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...sanitizedUser } = user;
      res.status(200).json(sanitizedUser);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { displayName } = req.body;
      const userReq = req.user;
      if (!userReq) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!displayName) {
        res.status(400).json({ error: 'Display name is required' });
        return;
      }

      const updatedUser = await authService.updateProfile(userReq.id, displayName);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...sanitizedUser } = updatedUser;
      res.status(200).json(sanitizedUser);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Display name')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const state = crypto.randomBytes(32).toString('hex');
      req.session.oauthState = state;
      const url = oauthService.getGoogleAuthUrl(state);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query;
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      if (!state || typeof state !== 'string' || state !== req.session.oauthState) {
        logger.error('Invalid or missing Google OAuth state parameter');
        res.redirect(`${clientUrl}/login?error=Invalid+OAuth+state`);
        return;
      }
      delete req.session.oauthState;

      if (!code || typeof code !== 'string') {
        res.redirect(`${clientUrl}/login?error=Invalid+Google+OAuth+code`);
        return;
      }

      const googleUser = await oauthService.getGoogleUserFromCode(code);
      
      const { user, session } = await authService.handleOAuthLogin(
        googleUser.email,
        googleUser.name,
        AuthProvider.GOOGLE
      );

      req.session.sessionId = session.id;
      req.session.userId = user.id;

      res.redirect(`${clientUrl}/dashboard`);
    } catch (error) {
      logger.error('Google OAuth error:', error);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/login?error=Google+login+failed`);
    }
  }

  async githubAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const state = crypto.randomBytes(32).toString('hex');
      req.session.oauthState = state;
      const url = oauthService.getGithubAuthUrl(state);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async githubCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query;
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

      if (!state || typeof state !== 'string' || state !== req.session.oauthState) {
        logger.error('Invalid or missing GitHub OAuth state parameter');
        res.redirect(`${clientUrl}/login?error=Invalid+OAuth+state`);
        return;
      }
      delete req.session.oauthState;

      if (!code || typeof code !== 'string') {
        res.redirect(`${clientUrl}/login?error=Invalid+GitHub+OAuth+code`);
        return;
      }

      const githubUser = await oauthService.getGithubUserFromCode(code);
      
      const { user, session } = await authService.handleOAuthLogin(
        githubUser.email,
        githubUser.name,
        AuthProvider.GITHUB,
        githubUser.username
      );

      req.session.sessionId = session.id;
      req.session.userId = user.id;

      res.redirect(`${clientUrl}/dashboard`);
    } catch (error) {
      logger.error('GitHub OAuth error:', error);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/login?error=GitHub+login+failed`);
    }
  }
}

export const authController = new AuthController();
