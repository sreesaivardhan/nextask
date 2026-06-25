import { Router } from 'express';
import { columnController } from '../controllers/column.controller';
import { requireSession } from '../middleware/auth';

// Mounted with { mergeParams: true } from boardRouter
export const columnRouter = Router({ mergeParams: true });

columnRouter.use(requireSession);

columnRouter.get('/', columnController.getColumns);
columnRouter.post('/', columnController.createColumn);
columnRouter.patch('/:columnId', columnController.updateColumn);
columnRouter.delete('/:columnId', columnController.deleteColumn);
columnRouter.put('/:columnId/reorder', columnController.reorderColumn);
