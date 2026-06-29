import axios from 'axios';

// During development, assume the NexTask server runs on localhost:3001
// and the React frontend runs on localhost:5173.
// In production, these would be environment variables or resolved from storage.
export const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';
export const WEB_APP_URL = (import.meta.env.VITE_WEB_APP_URL as string | undefined) ?? 'http://localhost:5173';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true, // Crucial for using existing session cookies
});

// Intercept requests to manually attach the session cookie if we are in the extension context.
// This is required because modern browsers block SameSite=Lax cookies on cross-origin requests
// (like chrome-extension:// -> http://localhost:3001).
api.interceptors.request.use(async (config) => {
  if (typeof chrome !== 'undefined' && chrome.cookies) {
    try {
      const cookie = await chrome.cookies.get({ url: BACKEND_URL, name: 'connect.sid' });
      if (cookie) {
        config.headers['X-Extension-Session'] = cookie.value;
      }
    } catch (e) {
      console.warn('Failed to get cookie', e);
    }
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Board {
  id: string;
  name: string;
  role?: string;
  owner?: { displayName: string };
}

export interface Column {
  id: string;
  name: string;
}

export const authService = {
  async getSession(): Promise<User> {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const boardService = {
  async getBoards(): Promise<Board[]> {
    const res = await api.get('/boards');
    return res.data;
  },
  async getColumns(boardId: string): Promise<Column[]> {
    const res = await api.get(`/boards/${boardId}`);
    return res.data.columns || [];
  },
};

export const cardService = {
  async createCard(data: {
    boardId: string;
    columnId: string;
    title: string;
    description?: string;
    creationSource?: string;
    referenceUrl?: string;
  }): Promise<void> {
    await api.post('/cards', data);
  },
};
