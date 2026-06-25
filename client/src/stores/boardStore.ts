import { create } from 'zustand';
import { api } from '../services/api';

export interface Board {
  id: string;
  name: string;
  createdAt: string;
}

interface BoardStore {
  boards: Board[];
  isLoading: boolean;
  fetchBoards: () => Promise<void>;
  createBoard: (name: string) => Promise<Board>;
  updateBoard: (id: string, name: string) => Promise<Board>;
  deleteBoard: (id: string) => Promise<void>;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  boards: [],
  isLoading: false,
  fetchBoards: async () => {
    set({ isLoading: true });
    try {
      const boards = await api.get('/boards');
      set({ boards, isLoading: false });
    } catch {
      set({ boards: [], isLoading: false });
    }
  },
  createBoard: async (name) => {
    const board = await api.post('/boards', { name });
    set({ boards: [board, ...get().boards] });
    return board;
  },
  updateBoard: async (id, name) => {
    const updatedBoard = await api.patch(`/boards/${id}`, { name });
    set({ boards: get().boards.map((b) => (b.id === id ? updatedBoard : b)) });
    return updatedBoard;
  },
  deleteBoard: async (id) => {
    await api.delete(`/boards/${id}`);
    set({ boards: get().boards.filter((b) => b.id !== id) });
  },
}));
