import { Router } from 'express';
import { boardController } from '../controllers/board.controller';
import { requireSession } from '../middleware/auth';
import { columnRouter } from './column.routes';
import { boardMemberController } from '../controllers/boardMember.controller';

export const boardRouter = Router();

boardRouter.use(requireSession);

boardRouter.get('/', boardController.getBoards);
boardRouter.post('/', boardController.createBoard);
boardRouter.get('/:boardId', boardController.getBoardById);
boardRouter.patch('/:boardId', boardController.updateBoard);
boardRouter.delete('/:boardId', boardController.deleteBoard);

// Board members (for assignee dropdown)
boardRouter.get('/:boardId/members', boardMemberController.getMembers);

// Mount column router under boards
boardRouter.use('/:boardId/columns', columnRouter);
