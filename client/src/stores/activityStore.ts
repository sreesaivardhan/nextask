import { create } from 'zustand';
import { api } from '../services/api';

export interface ActivityLog {
  id: string;
  boardId: string;
  userId: string | null;
  type: string;
  entityType: string;
  entityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  createdAt: string;
  user?: { id: string; displayName: string } | null;
}

interface ActivityStore {
  activities: Record<string, ActivityLog[]>; // Keyed by entityId (cardId)
  isLoading: boolean;
  fetchActivity: (cardId: string, boardId: string) => Promise<void>;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: {},
  isLoading: false,
  fetchActivity: async (cardId, boardId) => {
    set({ isLoading: true });
    try {
      const fetched: ActivityLog[] = await api.get(`/cards/${cardId}/activity?boardId=${boardId}`);
      set({
        activities: { ...get().activities, [cardId]: fetched },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
