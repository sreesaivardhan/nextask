import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { requireSession } from '../middleware/auth';

export const userRouter = Router();

userRouter.use(requireSession);

userRouter.get('/search', userController.searchUsers);
