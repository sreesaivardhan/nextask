import { Router } from 'express';
import { cardController } from '../controllers/card.controller';
import { requireSession } from '../middleware/auth';

export const cardRouter = Router({ mergeParams: true });

cardRouter.use(requireSession);

// Mounted at /api
cardRouter.get('/boards/:boardId/cards', cardController.getCards);
cardRouter.post('/cards', cardController.createCard);
cardRouter.patch('/cards/:id', cardController.updateCard);
cardRouter.delete('/cards/:id', cardController.deleteCard);
cardRouter.put('/cards/:id/move', cardController.moveCard);
