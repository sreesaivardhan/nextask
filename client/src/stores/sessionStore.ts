import { create } from 'zustand';
import { api } from '../services/api';

export interface User {
  id: string;
  displayName: string;
  githubUsername: string | null;
  createdAt: string;
}

interface SessionStore {
  user: User | null;
  isLoading: boolean;
  checkSession: () => Promise<void>;
  createSession: (displayName: string) => Promise<void>;
  deleteSession: () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set) => ({
  user: null,
  isLoading: true,
  checkSession: async () => {
    try {
      const user = await api.get('/session');
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
  createSession: async (displayName) => {
    const user = await api.post('/session', { displayName });
    set({ user });
  },
  deleteSession: async () => {
    await api.delete('/session');
    set({ user: null });
  },
}));
