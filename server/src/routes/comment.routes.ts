import { Router } from 'express';
import { commentController } from '../controllers/comment.controller';
import { requireSession } from '../middleware/auth';

// Root level /api
export const commentRouter = Router({ mergeParams: true });

commentRouter.use(requireSession);

// GET /api/cards/:cardId/comments
commentRouter.get('/cards/:cardId/comments', commentController.getComments);

// POST /api/cards/:cardId/comments
commentRouter.post('/cards/:cardId/comments', commentController.createComment);

// DELETE /api/comments/:commentId
commentRouter.delete('/comments/:commentId', commentController.deleteComment);
