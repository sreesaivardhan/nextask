import { Router } from 'express';
import { getLatestDigest, generateDigest } from '../controllers/digest.controller';
import { requireSession } from '../middleware/auth';

export const aiRouter = Router();

aiRouter.use(requireSession);

// Expose standard REST endpoints based on CONTRACT.md
aiRouter.get('/digest/:boardId', getLatestDigest); // Get daily AI digest for a board
aiRouter.post('/digest/:boardId/generate', generateDigest); // Generate manually (optional, useful for testing)
