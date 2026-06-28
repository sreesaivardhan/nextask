import { cardRepository } from '../repositories/card.repository';
import { boardRepository } from '../repositories/board.repository';
import { columnRepository } from '../repositories/column.repository';
import { activityLogService } from './activityLog.service';
import { boardMemberRepository } from '../repositories/boardMember.repository';
import { userRepository } from '../repositories/user.repository';
import { Card, ComplexityStatus } from '@prisma/client';
import { authzService } from './authorization.service';
import { inferCardComplexity, invalidateHistoricalState, invalidateBoardInsights } from './ai.service';

export class CardService {
  async getCards(boardId: string, userId: string): Promise<Card[]> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
    return cardRepository.findAllByBoardId(boardId);
  }

  async createCard(
    boardId: string,
    columnId: string,
    userId: string,
    data: { title: string; description?: string; complexity?: number; assigneeId?: string; creationSource?: string; referenceUrl?: string }
  ): Promise<Card> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

    const column = await columnRepository.findById(columnId);
    if (!column || column.boardId !== boardId) {
      throw new Error('Column not found');
    }

    const trimmedTitle = data.title.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) {
      throw new Error('Invalid card title');
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

    let finalDescription = data.description;
    if (finalDescription && finalDescription.length > 5000) {
      finalDescription = finalDescription.substring(0, 5000);
    }
    
    const maxPos = await cardRepository.getMaxPosition(columnId);
    const position = maxPos + 65535;

    const card = await cardRepository.create({
      boardId,
      columnId,
      title: trimmedTitle,
      position,
      description: finalDescription,
      complexity: data.complexity,
      assigneeId: data.assigneeId,
    });

    await activityLogService.log(boardId, userId, 'CARD_CREATED', 'Card', card.id, { 
      title: card.title,
      creationSource: data.creationSource,
      referenceUrl: data.referenceUrl
    });

    // Asynchronously trigger AI complexity inference (fire-and-forget)
    inferCardComplexity(card.id).catch(console.error);
    
    // Invalidate deadline prediction insights
    invalidateBoardInsights(card.boardId).catch(console.error);

    return card;
  }

  async updateCard(
    cardId: string,
    userId: string,
    currentVersion: number,
    data: { title?: string; description?: string; complexity?: number; assigneeId?: string; complexityStatus?: ComplexityStatus }
  ): Promise<Card> {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    await authzService.requireBoardRole(card.boardId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

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
      // Allow AI suggested story points to bypass board complexityMax if they are standard SP values
      const standardSPs = [1, 2, 3, 5, 8, 13];
      const board = await boardRepository.findById(card.boardId);
      const isStandardSP = standardSPs.includes(data.complexity);
      
      if (!isStandardSP && (data.complexity < 1 || data.complexity > (board?.complexityMax || 5))) {
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

      let historicalEligibilityChanged = false;
      if (data.complexityStatus === 'ACCEPTED' && card.complexityStatus !== 'ACCEPTED') {
        await activityLogService.log(card.boardId, userId, 'AI_COMPLEXITY_ACCEPTED', 'Card', card.id, {
          title: 'Accepted AI complexity suggestion.'
        });
        historicalEligibilityChanged = true;
      }
      if (data.complexityStatus === 'OVERRIDDEN') {
        await activityLogService.log(card.boardId, userId, 'AI_COMPLEXITY_OVERRIDDEN', 'Card', card.id, {
          title: `Overrode AI complexity from ${card.suggestedSp ?? 'Unknown'} SP to ${data.complexity} SP.`
        });
        historicalEligibilityChanged = true;
      }
      
      if (data.complexity !== undefined && data.complexity !== card.complexity) {
        historicalEligibilityChanged = true;
      }

      // Trigger AI inference if description changed
      if (data.description !== undefined && data.description !== card.description) {
        historicalEligibilityChanged = true;
        inferCardComplexity(card.id).catch(console.error);
      }

      if (data.title !== undefined && data.title !== card.title) {
        historicalEligibilityChanged = true;
      }

      if (historicalEligibilityChanged) {
        let reason = 'update';
        if (data.complexityStatus === 'ACCEPTED') reason = 'accept';
        if (data.complexityStatus === 'OVERRIDDEN') reason = 'override';
        invalidateHistoricalState(card.boardId, undefined, reason).catch(console.error);
      }

      const insightsInvalidated = (
        (data.title !== undefined && data.title !== card.title) ||
        (data.complexity !== undefined && data.complexity !== card.complexity) ||
        (data.assigneeId !== undefined && data.assigneeId !== card.assigneeId)
      );

      if (insightsInvalidated) {
        invalidateBoardInsights(card.boardId).catch(console.error);
      }

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

    await authzService.requireBoardRole(card.boardId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

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

      if (data.columnId !== card.columnId) {
        invalidateHistoricalState(card.boardId, undefined, 'move').catch(console.error);
        invalidateBoardInsights(card.boardId).catch(console.error);
      }

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

    await authzService.requireBoardRole(card.boardId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

    await cardRepository.delete(cardId);
    await activityLogService.log(card.boardId, userId, 'CARD_DELETED', 'Card', card.id, { title: card.title });
    
    invalidateHistoricalState(card.boardId, card.id, 'delete').catch(console.error);
    invalidateBoardInsights(card.boardId).catch(console.error);
  }

  /** Lightweight helper to fetch boardId/columnId for socket broadcast before deletion. */
  async findCardById(cardId: string): Promise<Card | null> {
    return cardRepository.findById(cardId);
  }
}

export const cardService = new CardService();
