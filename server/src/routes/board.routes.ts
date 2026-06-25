import { Router } from 'express';
import { boardController } from '../controllers/board.controller';
import { requireSession } from '../middleware/auth';
import { columnRouter } from './column.routes';

export const boardRouter = Router();

boardRouter.use(requireSession);

boardRouter.get('/', boardController.getBoards);
boardRouter.post('/', boardController.createBoard);
boardRouter.get('/:boardId', boardController.getBoardById);
boardRouter.patch('/:boardId', boardController.updateBoard);
boardRouter.delete('/:boardId', boardController.deleteBoard);

// Mount column router under boards
boardRouter.use('/:boardId/columns', columnRouter);

