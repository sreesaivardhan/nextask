import { create } from 'zustand';
import { api } from '../services/api';

export interface UserSearchResult {
  id: string;
  displayName: string;
  email: string | null;
}

interface UserStore {
  searchResults: UserSearchResult[];
  isSearching: boolean;
  searchUsers: (query: string, boardId?: string) => Promise<void>;
  clearSearch: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  searchResults: [],
  isSearching: false,
  searchUsers: async (query, boardId) => {
    if (!query) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const qs = new URLSearchParams({ q: query });
      if (boardId) qs.append('boardId', boardId);
      const results = await api.get(`/users/search?${qs.toString()}`);
      set({ searchResults: results, isSearching: false });
    } catch {
      set({ searchResults: [], isSearching: false });
    }
  },
  clearSearch: () => set({ searchResults: [], isSearching: false }),
}));
