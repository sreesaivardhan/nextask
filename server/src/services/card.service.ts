import { cardRepository } from '../repositories/card.repository';
import { boardRepository } from '../repositories/board.repository';
import { columnRepository } from '../repositories/column.repository';
import { activityLogService } from './activityLog.service';
import { boardMemberRepository } from '../repositories/boardMember.repository';
import { userRepository } from '../repositories/user.repository';
import { Card } from '@prisma/client';

export class CardService {
  async getCards(boardId: string, userId: string): Promise<Card[]> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }
    return cardRepository.findAllByBoardId(boardId);
  }

  async createCard(
    boardId: string,
    columnId: string,
    userId: string,
    data: { title: string; description?: string; complexity?: number; assigneeId?: string }
  ): Promise<Card> {
    const hasAccess = await boardRepository.isMember(boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const column = await columnRepository.findById(columnId);
    if (!column || column.boardId !== boardId) {
      throw new Error('Column not found');
    }

    const trimmedTitle = data.title.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) {
      throw new Error('Invalid card title');
    }

    if (data.description && data.description.length > 5000) {
      throw new Error('Description too long');
    }

    const board = await boardRepository.findById(boardId);
    if (data.complexity) {
      if (data.complexity < 1 || data.complexity > (board?.complexityMax || 5)) {
        throw new Error('Invalid complexity');
      }
    }

    if (data.assigneeId) {
      const members = await boardMemberRepository.findMembersByBoardId(boardId);
      const isValidMember = members.some((m) => m.userId === data.assigneeId);
      if (!isValidMember) {
        throw new Error('Assignee is not a member of this board');
      }
    }

    const maxPos = await cardRepository.getMaxPosition(columnId);
    const position = maxPos + 65535;

    const card = await cardRepository.create({
      boardId,
      columnId,
      title: trimmedTitle,
      position,
      description: data.description,
      complexity: data.complexity,
      assigneeId: data.assigneeId,
    });

    await activityLogService.log(boardId, userId, 'CARD_CREATED', 'Card', card.id, { title: card.title });

    return card;
  }

  async updateCard(
    cardId: string,
    userId: string,
    currentVersion: number,
    data: { title?: string; description?: string; complexity?: number; assigneeId?: string }
  ): Promise<Card> {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const hasAccess = await boardRepository.isMember(card.boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    if (data.title !== undefined) {
      const trimmedTitle = data.title.trim();
      if (!trimmedTitle || trimmedTitle.length > 200) {
        throw new Error('Invalid card title');
      }
      data.title = trimmedTitle;
    }

    if (data.description !== undefined && data.description !== null && data.description.length > 5000) {
      throw new Error('Description too long');
    }

    if (data.complexity !== undefined && data.complexity !== null) {
      const board = await boardRepository.findById(card.boardId);
      if (data.complexity < 1 || data.complexity > (board?.complexityMax || 5)) {
        throw new Error('Invalid complexity');
      }
    }

    if (data.assigneeId !== undefined && data.assigneeId !== null) {
      const members = await boardMemberRepository.findMembersByBoardId(card.boardId);
      const isValidMember = members.some((m) => m.userId === data.assigneeId);
      if (!isValidMember) {
        throw new Error('Assignee is not a member of this board');
      }
    }

    try {
      const updatedCard = await cardRepository.update(cardId, currentVersion, {
        ...data,
        lastEditedByUserId: userId,
      });

      // Log granular changes with human-readable values
      if (data.title !== undefined && data.title !== card.title) {
        await activityLogService.log(card.boardId, userId, 'CARD_RENAMED', 'Card', card.id, {
          from: card.title,
          to: data.title,
        });
      }

      if (data.description !== undefined && data.description !== card.description) {
        await activityLogService.log(card.boardId, userId, 'CARD_DESCRIPTION_UPDATED', 'Card', card.id);
      }

      if (data.complexity !== undefined && data.complexity !== card.complexity) {
        await activityLogService.log(card.boardId, userId, 'COMPLEXITY_CHANGED', 'Card', card.id, {
          from: card.complexity ?? 'Unset',
          to: data.complexity ?? 'Unset',
        });
      }

      if (data.assigneeId !== undefined && data.assigneeId !== card.assigneeId) {
        // Resolve display names — never store raw IDs in the history log
        const [oldUser, newUser] = await Promise.all([
          card.assigneeId ? userRepository.findById(card.assigneeId) : Promise.resolve(null),
          data.assigneeId ? userRepository.findById(data.assigneeId) : Promise.resolve(null),
        ]);
        await activityLogService.log(card.boardId, userId, 'ASSIGNMENT_CHANGED', 'Card', card.id, {
          from: oldUser?.displayName ?? 'Unassigned',
          to: newUser?.displayName ?? 'Unassigned',
        });
      }

      await activityLogService.log(card.boardId, userId, 'CARD_UPDATED', 'Card', card.id);

      return updatedCard;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'P2025') {
        throw new Error('Version conflict: The card has been modified by someone else. Please refresh and try again.');
      }
      throw error;
    }
  }

  async moveCard(
    cardId: string,
    userId: string,
    currentVersion: number,
    data: { columnId: string; position: number }
  ): Promise<Card> {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const hasAccess = await boardRepository.isMember(card.boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    const column = await columnRepository.findById(data.columnId);
    if (!column || column.boardId !== card.boardId) {
      throw new Error('Column not found or belongs to another board');
    }

    try {
      const updatedCard = await cardRepository.move(cardId, currentVersion, {
        columnId: data.columnId,
        position: data.position,
        lastEditedByUserId: userId,
      });

      await activityLogService.log(card.boardId, userId, 'CARD_MOVED', 'Card', card.id, {
        fromColumn: card.columnId,
        toColumn: data.columnId,
      });

      return updatedCard;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'P2025') {
        throw new Error('Version conflict: The card has been modified by someone else. Please refresh and try again.');
      }
      throw error;
    }
  }

  async deleteCard(cardId: string, userId: string): Promise<void> {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const hasAccess = await boardRepository.isMember(card.boardId, userId);
    if (!hasAccess) {
      throw new Error('Unauthorized access to board');
    }

    await cardRepository.delete(cardId);
    await activityLogService.log(card.boardId, userId, 'CARD_DELETED', 'Card', card.id, { title: card.title });
  }
}

export const cardService = new CardService();
