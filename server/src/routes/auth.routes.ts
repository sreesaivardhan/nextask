import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireSession } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authController.me);
authRouter.put('/profile', requireSession, authController.updateProfile);
authRouter.get('/google', authController.googleAuth);
authRouter.get('/google/callback', authController.googleCallback);

authRouter.get('/github', authController.githubAuth);
authRouter.get('/github/callback', authController.githubCallback);
