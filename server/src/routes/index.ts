import { Router } from 'express';
import { healthRouter } from './health.routes';
import { sessionRouter } from './session.routes';
import { boardRouter } from './board.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/session', sessionRouter);
apiRouter.use('/boards', boardRouter);

