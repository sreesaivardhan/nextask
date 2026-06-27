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
  forceFetchMembers: (boardId: string) => Promise<void>;
  addMember: (boardId: string, userId: string, role: string) => Promise<void>;
  updateRole: (boardId: string, userId: string, role: string) => Promise<void>;
  removeMember: (boardId: string, userId: string) => Promise<void>;
  leaveBoard: (boardId: string) => Promise<void>;
}

export const useBoardMemberStore = create<BoardMemberStore>((set, get) => ({
  members: {},
  fetchMembers: async (boardId) => {
    if (get().members[boardId]) return;
    try {
      const fetched: BoardMember[] = await api.get(`/boards/${boardId}/members`);
      set({ members: { ...get().members, [boardId]: fetched } });
    } catch {
      // ignore
    }
  },
  forceFetchMembers: async (boardId: string) => {
    try {
      const fetched: BoardMember[] = await api.get(`/boards/${boardId}/members`);
      set({ members: { ...get().members, [boardId]: fetched } });
    } catch {
      // ignore
    }
  },
  addMember: async (boardId: string, userId: string, role: string) => {
    await api.post(`/boards/${boardId}/members`, { userId, role });
    await get().forceFetchMembers(boardId);
  },
  updateRole: async (boardId: string, userId: string, role: string) => {
    await api.patch(`/boards/${boardId}/members/${userId}`, { role });
    await get().forceFetchMembers(boardId);
  },
  removeMember: async (boardId: string, userId: string) => {
    await api.delete(`/boards/${boardId}/members/${userId}`);
    await get().forceFetchMembers(boardId);
  },
  leaveBoard: async (boardId: string) => {
    await api.post(`/boards/${boardId}/leave`, {});
  }
}));
