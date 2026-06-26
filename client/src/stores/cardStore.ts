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
    _fromColumnId: string,
    toColumnId: string,
    newPosition: number
  ) => Promise<Card>;
  // Socket-driven mutations (update Zustand directly without refetching)
  socketAddCard: (card: Card) => void;
  socketUpdateCard: (card: Card) => void;
  socketRemoveCard: (cardId: string, columnId: string) => void;
  socketMoveCard: (card: Card) => void;
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
  moveCard: async (cardId, version, _fromColumnId, toColumnId, newPosition) => {
    const currentCards = get().cards;
    
    let cardToMove: Card | undefined;
    for (const col of Object.values(currentCards)) {
      cardToMove = col.find((c) => c.id === cardId);
      if (cardToMove) break;
    }
    
    if (!cardToMove) throw new Error('Card not found locally');

    const optimisticCard = { ...cardToMove, columnId: toColumnId, position: newPosition, version: version + 1 };
    
    const newCards = { ...currentCards };
    for (const colId of Object.keys(newCards)) {
      newCards[colId] = newCards[colId].filter((c) => c.id !== cardId);
    }
    
    newCards[toColumnId] = [...(newCards[toColumnId] || []), optimisticCard].sort((a, b) => a.position - b.position);

    set({ cards: newCards });

    try {
      const updatedCard = await api.put(`/cards/${cardId}/move`, {
        version,
        columnId: toColumnId,
        position: newPosition,
      });

      const latestCards = get().cards;
      const latestWithUpdate = { ...latestCards };
      
      for (const colId of Object.keys(latestWithUpdate)) {
        latestWithUpdate[colId] = latestWithUpdate[colId].filter((c) => c.id !== cardId);
      }
      
      latestWithUpdate[updatedCard.columnId] = [...(latestWithUpdate[updatedCard.columnId] || []), updatedCard].sort((a, b) => a.position - b.position);

      set({ cards: latestWithUpdate });
      return updatedCard;
    } catch (err) {
      // Revert optimistic update
      set({ cards: currentCards });
      throw err;
    }
  },

  // ── Socket-driven mutations ──────────────────────────────────────────────────
  socketAddCard: (card) => {
    const current = get().cards;
    
    // Check if it already exists ANYWHERE to avoid duplicates
    let exists = false;
    for (const colCards of Object.values(current)) {
      if (colCards.some((c) => c.id === card.id)) {
        exists = true;
        break;
      }
    }
    if (exists) return;

    const colCards = current[card.columnId] || [];
    set({
      cards: {
        ...current,
        [card.columnId]: [...colCards, card].sort((a, b) => a.position - b.position),
      },
    });
  },
  socketUpdateCard: (card) => {
    const current = get().cards;
    // The card might be in a different column if it was moved; find it across all columns
    const updatedCards: Record<string, Card[]> = {};
    let found = false;
    for (const colId of Object.keys(current)) {
      updatedCards[colId] = current[colId].map((c) => {
        if (c.id === card.id) {
          found = true;
          return card;
        }
        return c;
      });
    }
    if (found) {
      set({ cards: updatedCards });
    }
  },
  socketRemoveCard: (cardId, columnId) => {
    const current = get().cards;
    if (!current[columnId]) return;
    set({
      cards: {
        ...current,
        [columnId]: current[columnId].filter((c) => c.id !== cardId),
      },
    });
  },
  socketMoveCard: (card) => {
    const current = get().cards;
    const nextCards = { ...current };
    
    // Remove from all columns to prevent duplicates
    for (const colId of Object.keys(nextCards)) {
      nextCards[colId] = nextCards[colId].filter((c) => c.id !== card.id);
    }
    
    // Add to new column
    const toCol = [...(nextCards[card.columnId] || []), card];
    toCol.sort((a, b) => a.position - b.position);
    
    nextCards[card.columnId] = toCol;
    
    set({ cards: nextCards });
  },
}));
