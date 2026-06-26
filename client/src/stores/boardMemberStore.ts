import { create } from 'zustand';
import { api } from '../services/api';

export interface BoardMember {
  boardId: string;
  userId: string;
  role: string;
  user: { id: string; displayName: string };
}

interface BoardMemberStore {
  members: Record<string, BoardMember[]>; // keyed by boardId
  fetchMembers: (boardId: string) => Promise<void>;
}

export const useBoardMemberStore = create<BoardMemberStore>((set, get) => ({
  members: {},
  fetchMembers: async (boardId) => {
    // Avoid re-fetching if already loaded
    if (get().members[boardId]) return;
    try {
      const fetched: BoardMember[] = await api.get(`/boards/${boardId}/members`);
      set({ members: { ...get().members, [boardId]: fetched } });
    } catch {
      // Non-fatal: assignment will just have no options
    }
  },
}));
