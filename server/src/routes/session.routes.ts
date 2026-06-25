import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';

export const sessionRouter = Router();

sessionRouter.post('/', sessionController.createSession);
sessionRouter.get('/', sessionController.getSession);
sessionRouter.delete('/', sessionController.deleteSession);
