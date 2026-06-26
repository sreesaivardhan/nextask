import { create } from 'zustand';
import { api } from '../services/api';

export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string };
}

interface CommentStore {
  comments: Record<string, Comment[]>; // Keyed by cardId
  isLoading: boolean;
  fetchComments: (cardId: string, boardId: string) => Promise<void>;
  createComment: (cardId: string, boardId: string, body: string) => Promise<Comment>;
  deleteComment: (commentId: string, cardId: string, boardId: string) => Promise<void>;
}

export const useCommentStore = create<CommentStore>((set, get) => ({
  comments: {},
  isLoading: false,
  fetchComments: async (cardId, boardId) => {
    set({ isLoading: true });
    try {
      const fetched: Comment[] = await api.get(`/cards/${cardId}/comments?boardId=${boardId}`);
      set({
        comments: { ...get().comments, [cardId]: fetched },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
  createComment: async (cardId, boardId, body) => {
    const newComment = await api.post(`/cards/${cardId}/comments`, { boardId, body });
    const current = get().comments[cardId] || [];
    set({
      comments: { ...get().comments, [cardId]: [...current, newComment] },
    });
    return newComment;
  },
  deleteComment: async (commentId, cardId, boardId) => {
    await api.delete(`/comments/${commentId}?cardId=${cardId}&boardId=${boardId}`);
    const current = get().comments[cardId] || [];
    set({
      comments: { ...get().comments, [cardId]: current.filter((c) => c.id !== commentId) },
    });
  },
}));
