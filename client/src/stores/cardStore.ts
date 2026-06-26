import { create } from 'zustand';
import { api } from '../services/api';

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  complexity: number | null;
  assigneeId: string | null;
  version: number;
  position: number;
  createdAt: string;
}

interface CardStore {
  cards: Record<string, Card[]>; // Keyed by columnId
  isLoading: boolean;
  fetchCards: (boardId: string) => Promise<void>;
  createCard: (
    boardId: string,
    columnId: string,
    title: string,
    description?: string,
    complexity?: number,
    assigneeId?: string
  ) => Promise<Card>;
  updateCard: (
    cardId: string,
    columnId: string,
    version: number,
    updates: { title?: string; description?: string | null; complexity?: number | null; assigneeId?: string | null }
  ) => Promise<Card>;
  deleteCard: (cardId: string, columnId: string) => Promise<void>;
  moveCard: (
    cardId: string,
    version: number,
    fromColumnId: string,
    toColumnId: string,
    newPosition: number
  ) => Promise<Card>;
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: {},
  isLoading: false,
  fetchCards: async (boardId) => {
    set({ isLoading: true });
    try {
      const allCards: Card[] = await api.get(`/boards/${boardId}/cards`);
      const grouped: Record<string, Card[]> = {};
      allCards.forEach((card) => {
        if (!grouped[card.columnId]) grouped[card.columnId] = [];
        grouped[card.columnId].push(card);
      });
      set({ cards: grouped, isLoading: false });
    } catch {
      set({ cards: {}, isLoading: false });
    }
  },
  createCard: async (boardId, columnId, title, description, complexity, assigneeId) => {
    const newCard = await api.post(`/cards`, {
      boardId,
      columnId,
      title,
      description,
      complexity,
      assigneeId,
    });
    const currentCards = get().cards;
    set({
      cards: {
        ...currentCards,
        [columnId]: [...(currentCards[columnId] || []), newCard].sort((a, b) => a.position - b.position),
      },
    });
    return newCard;
  },
  updateCard: async (cardId, columnId, version, updates) => {
    const updatedCard = await api.patch(`/cards/${cardId}`, { version, ...updates });
    const currentCards = get().cards;
    set({
      cards: {
        ...currentCards,
        [columnId]: (currentCards[columnId] || []).map((c) => (c.id === cardId ? updatedCard : c)),
      },
    });
    return updatedCard;
  },
  deleteCard: async (cardId, columnId) => {
    await api.delete(`/cards/${cardId}`);
    const currentCards = get().cards;
    set({
      cards: {
        ...currentCards,
        [columnId]: (currentCards[columnId] || []).filter((c) => c.id !== cardId),
      },
    });
  },
  moveCard: async (cardId, version, fromColumnId, toColumnId, newPosition) => {
    // Optimistic update
    const currentCards = get().cards;
    const cardToMove = currentCards[fromColumnId]?.find((c) => c.id === cardId);
    
    if (!cardToMove) throw new Error('Card not found locally');

    const optimisticCard = { ...cardToMove, columnId: toColumnId, position: newPosition, version: version + 1 };
    
    const newFromCol = currentCards[fromColumnId].filter((c) => c.id !== cardId);
    const newToCol = [...(currentCards[toColumnId] || []), optimisticCard].sort((a, b) => a.position - b.position);

    set({
      cards: {
        ...currentCards,
        [fromColumnId]: newFromCol,
        [toColumnId]: newToCol,
      },
    });

    try {
      const updatedCard = await api.put(`/cards/${cardId}/move`, {
        version,
        columnId: toColumnId,
        position: newPosition,
      });

      // Update with server truth
      const latestCards = get().cards;
      set({
        cards: {
          ...latestCards,
          [toColumnId]: (latestCards[toColumnId] || [])
            .map((c) => (c.id === cardId ? updatedCard : c))
            .sort((a, b) => a.position - b.position),
        },
      });
      return updatedCard;
    } catch (err) {
      // Revert optimistic update
      set({ cards: currentCards });
      throw err;
    }
  },
}));
