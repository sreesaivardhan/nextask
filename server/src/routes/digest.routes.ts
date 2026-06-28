import { Router } from 'express';
import { getLatestDigest, getDigests, generateDigest } from '../controllers/digest.controller';

export const digestRouter = Router({ mergeParams: true });

digestRouter.get('/latest', getLatestDigest);
digestRouter.get('/', getDigests);
digestRouter.post('/generate', generateDigest);
