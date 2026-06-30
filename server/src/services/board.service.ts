import { boardRepository } from '../repositories/board.repository';
import { Board } from '@prisma/client';
import { authzService } from './authorization.service';
import { columnService } from './column.service';
import { cardService } from './card.service';
import { prisma } from '../utils/prisma';

const TEMPLATES: Record<string, {
  columns: string[];
  labels: { name: string; color: string }[];
  cards: { title: string; columnName: string; labelNames: string[] }[];
}> = {
  'Software Sprint': {
    columns: ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'],
    labels: [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#3b82f6' },
      { name: 'Enhancement', color: '#10b981' },
      { name: 'Documentation', color: '#6366f1' },
      { name: 'High Priority', color: '#f59e0b' },
    ],
    cards: [
      { title: 'Configure project repository', columnName: 'Todo', labelNames: ['Feature'] },
      { title: 'Implement authentication', columnName: 'Todo', labelNames: ['Feature', 'High Priority'] },
      { title: 'Setup CI/CD pipeline', columnName: 'Todo', labelNames: ['Enhancement'] },
    ],
  },
  'Product Roadmap': {
    columns: ['Ideas', 'Planned', 'In Development', 'Testing', 'Released'],
    labels: [
      { name: 'Feature', color: '#3b82f6' },
      { name: 'Improvement', color: '#10b981' },
      { name: 'Research', color: '#8b5cf6' },
      { name: 'Customer Request', color: '#f59e0b' },
    ],
    cards: [
      { title: 'Mobile App MVP', columnName: 'Planned', labelNames: ['Feature'] },
      { title: 'Dark Mode', columnName: 'Planned', labelNames: ['Improvement'] },
      { title: 'Analytics Dashboard', columnName: 'Ideas', labelNames: ['Research'] },
    ],
  },
  'Bug Tracker': {
    columns: ['New', 'Confirmed', 'Fixing', 'QA Testing', 'Closed'],
    labels: [
      { name: 'Critical', color: '#b91c1c' },
      { name: 'High', color: '#ef4444' },
      { name: 'Medium', color: '#f59e0b' },
      { name: 'Low', color: '#3b82f6' },
    ],
    cards: [
      { title: 'Login redirect issue', columnName: 'New', labelNames: ['High'] },
      { title: 'Dashboard rendering bug', columnName: 'New', labelNames: ['Medium'] },
      { title: 'Socket reconnect issue', columnName: 'Confirmed', labelNames: ['Critical'] },
    ],
  },
  'Content Calendar': {
    columns: ['Ideas', 'Draft', 'Review', 'Scheduled', 'Published'],
    labels: [
      { name: 'Blog', color: '#3b82f6' },
      { name: 'LinkedIn', color: '#0ea5e9' },
      { name: 'YouTube', color: '#ef4444' },
      { name: 'Twitter', color: '#06b6d4' },
    ],
    cards: [
      { title: 'Weekly product update', columnName: 'Draft', labelNames: ['Blog'] },
      { title: 'AI feature announcement', columnName: 'Ideas', labelNames: ['LinkedIn', 'Twitter'] },
      { title: 'Release notes', columnName: 'Draft', labelNames: ['Blog'] },
    ],
  },
  'Personal Planner': {
    columns: ['Upcoming', 'Today', 'In Progress', 'Completed'],
    labels: [
      { name: 'Personal', color: '#8b5cf6' },
      { name: 'Study', color: '#3b82f6' },
      { name: 'Work', color: '#10b981' },
      { name: 'Health', color: '#ef4444' },
    ],
    cards: [
      { title: 'Complete assignment', columnName: 'Today', labelNames: ['Study'] },
      { title: 'Workout', columnName: 'Today', labelNames: ['Health'] },
      { title: 'Read documentation', columnName: 'Upcoming', labelNames: ['Work'] },
    ],
  },
};

export class BoardService {
  async getBoards(userId: string): Promise<Board[]> {
    return boardRepository.findAllByUserId(userId);
  }

  async getBoardById(boardId: string, userId: string): Promise<Board> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    const board = await boardRepository.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }
    return board;
  }

  async createBoard(userId: string, name: string, template?: string): Promise<Board> {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error('Invalid board name');
    }
    
    const board = await boardRepository.create(userId, { name: trimmedName });

    if (template && template !== 'Blank Board' && TEMPLATES[template]) {
      const tpl = TEMPLATES[template];
      
      // 1. Create columns
      const columnMap = new Map<string, string>();
      for (const colName of tpl.columns) {
        const col = await columnService.createColumn(board.id, userId, colName);
        columnMap.set(colName, col.id);
      }

      // 2. Create labels
      const labelMap = new Map<string, string>();
      for (const lbl of tpl.labels) {
        const newLabel = await prisma.label.create({
          data: {
            boardId: board.id,
            name: lbl.name,
            color: lbl.color,
          }
        });
        labelMap.set(lbl.name, newLabel.id);
      }

      // 3. Create cards and attach labels
      for (const cardData of tpl.cards) {
        const columnId = columnMap.get(cardData.columnName);
        if (columnId) {
          const card = await cardService.createCard(board.id, columnId, userId, {
            title: cardData.title,
            creationSource: 'template'
          });

          // Attach labels
          const labelIdsToAttach = cardData.labelNames
            .map(name => labelMap.get(name))
            .filter((id): id is string => !!id);

          if (labelIdsToAttach.length > 0) {
            await prisma.cardLabel.createMany({
              data: labelIdsToAttach.map(labelId => ({
                cardId: card.id,
                labelId
              }))
            });
          }
        }
      }
    }

    return board;
  }

  async updateBoard(boardId: string, userId: string, data: { name?: string; sprintEndDate?: Date | null; complexityMax?: number | null }): Promise<Board> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER']);

    const updateData: { name?: string; sprintEndDate?: Date | null; complexityMax?: number | null } = {};
    
    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName || trimmedName.length > 100) {
        throw new Error('Invalid board name');
      }
      updateData.name = trimmedName;
    }

    if (data.sprintEndDate !== undefined) {
      updateData.sprintEndDate = data.sprintEndDate;
    }

    if (data.complexityMax !== undefined) {
      if (data.complexityMax !== null && (data.complexityMax < 1 || data.complexityMax > 10 || !Number.isInteger(data.complexityMax))) {
        throw new Error('Invalid complexity threshold. Must be an integer between 1 and 10.');
      }
      updateData.complexityMax = data.complexityMax;
    }

    return boardRepository.update(boardId, updateData);
  }

  async deleteBoard(boardId: string, userId: string): Promise<void> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER']);
    await boardRepository.delete(boardId);
  }

  async getAIInsights(boardId: string, userId: string): Promise<import('@prisma/client').AIInsight[]> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    const insights = await boardRepository.findAIInsights(boardId);
    return insights;
  }
}

export const boardService = new BoardService();
