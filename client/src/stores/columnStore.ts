import { create } from 'zustand';
import { api } from '../services/api';

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
}

interface ColumnStore {
  columns: Column[];
  isLoading: boolean;
  fetchColumns: (boardId: string) => Promise<void>;
  createColumn: (boardId: string, name: string) => Promise<Column>;
  updateColumn: (boardId: string, columnId: string, name: string) => Promise<Column>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  reorderColumn: (boardId: string, columnId: string, newPosition: number) => Promise<Column>;
}

export const useColumnStore = create<ColumnStore>((set, get) => ({
  columns: [],
  isLoading: false,
  fetchColumns: async (boardId) => {
    set({ isLoading: true });
    try {
      const columns = await api.get(`/boards/${boardId}/columns`);
      set({ columns, isLoading: false });
    } catch {
      set({ columns: [], isLoading: false });
    }
  },
  createColumn: async (boardId, name) => {
    const column = await api.post(`/boards/${boardId}/columns`, { name });
    set({ columns: [...get().columns, column].sort((a, b) => a.position - b.position) });
    return column;
  },
  updateColumn: async (boardId, columnId, name) => {
    const updated = await api.patch(`/boards/${boardId}/columns/${columnId}`, { name });
    set({ columns: get().columns.map((c) => (c.id === columnId ? updated : c)) });
    return updated;
  },
  deleteColumn: async (boardId, columnId) => {
    await api.delete(`/boards/${boardId}/columns/${columnId}`);
    set({ columns: get().columns.filter((c) => c.id !== columnId) });
  },
  reorderColumn: async (boardId, columnId, newPosition) => {
    const prevColumns = [...get().columns];
    set({
      columns: get().columns
        .map((c) => (c.id === columnId ? { ...c, position: newPosition } : c))
        .sort((a, b) => a.position - b.position),
    });
    try {
      const updated = await api.put(`/boards/${boardId}/columns/${columnId}/reorder`, {
        position: newPosition,
      });
      set({
        columns: get().columns
          .map((c) => (c.id === columnId ? updated : c))
          .sort((a, b) => a.position - b.position),
      });
      return updated;
    } catch (e) {
      set({ columns: prevColumns });
      throw e;
    }
  },
}));
