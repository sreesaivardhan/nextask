import { create } from 'zustand';
import { api } from '../services/api';
import { socketService } from '../services/socketService';

export interface User {
  id: string;
  displayName: string;
  githubUsername: string | null;
  createdAt: string;
  email?: string | null;
  emailVerified?: boolean;
}

interface SessionStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  createSession: (displayName: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  deleteSession: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  clearError: () => void;
  clearSessionLocally: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,
  clearSessionLocally: () => {
    set({ user: null, error: null });
    socketService.disconnect();
  },
  checkSession: async () => {
    try {
      const user = await api.get('/auth/me');
      set({ user, isLoading: false, error: null });
      if (user) {
        socketService.connect();
      }
    } catch {
      // fallback to old session check if new auth is disabled
      try {
        const user = await api.get('/session');
        set({ user, isLoading: false, error: null });
        if (user) socketService.connect();
      } catch {
        set({ user: null, isLoading: false, error: null });
      }
    }
  },
  getCurrentUser: async () => {
    await get().checkSession();
  },
  createSession: async (displayName) => {
    const user = await api.post('/session', { displayName });
    set({ user, error: null });
    socketService.connect();
  },
  register: async (displayName, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.post('/auth/register', { displayName, email, password });
      set({ user, isLoading: false, error: null });
      socketService.connect();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      set({ isLoading: false, error: error.response?.data?.error || error.message });
      throw err;
    }
  },
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.post('/auth/login', { email, password });
      set({ user, isLoading: false, error: null });
      socketService.connect();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      set({ isLoading: false, error: error.response?.data?.error || error.message });
      throw err;
    }
  },
  deleteSession: async () => {
    await api.post('/auth/logout');
    set({ user: null, error: null });
    socketService.disconnect();
  },
  logout: async () => {
    await get().deleteSession();
  },
  updateProfile: async (displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.put('/auth/profile', { displayName });
      set({ user, isLoading: false, error: null });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message: string };
      set({ isLoading: false, error: error.response?.data?.error || error.message });
      throw err;
    }
  },
  clearError: () => set({ error: null }),
}));
