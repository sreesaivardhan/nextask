import { Router } from 'express';
import { healthRouter } from './health.routes';
import { sessionRouter } from './session.routes';
import { boardRouter } from './board.routes';
import { cardRouter } from './card.routes';
import { commentRouter } from './comment.routes';
import { activityLogRouter } from './activityLog.routes';
import { authRouter } from './auth.routes';
import { userRouter } from './user.routes';
import { aiRouter } from './ai.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/session', sessionRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/boards', boardRouter);
apiRouter.use('/', cardRouter);
apiRouter.use('/', commentRouter);
apiRouter.use('/', activityLogRouter);
apiRouter.use('/ai', aiRouter);
