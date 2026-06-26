import { Router } from 'express';
import { healthRouter } from './health.routes';
import { sessionRouter } from './session.routes';
import { boardRouter } from './board.routes';
import { cardRouter } from './card.routes';
import { commentRouter } from './comment.routes';
import { activityLogRouter } from './activityLog.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/session', sessionRouter);
apiRouter.use('/boards', boardRouter);
apiRouter.use('/', cardRouter);
apiRouter.use('/', commentRouter);
apiRouter.use('/', activityLogRouter);

