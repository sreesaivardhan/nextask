import { create } from 'zustand';
import { api } from '../services/api';

export interface AIInsight {
  id: string;
  boardId: string;
  type: string;
  title: string;
  summary: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface InsightStore {
  insights: Record<string, AIInsight[]>;
  fetchInsights: (boardId: string) => Promise<void>;
  socketAddInsight: (insight: AIInsight) => void;
}

export const useInsightStore = create<InsightStore>((set) => ({
  insights: {},
  fetchInsights: async (boardId: string) => {
    try {
      const data = await api.get(`/boards/${boardId}/ai-insights`);
      
      // The backend returns insights ordered by createdAt DESC.
      // We only want to keep the latest insight for each type on the dashboard.
      const latestByType = new Map<string, AIInsight>();
      for (const insight of data) {
        if (!latestByType.has(insight.type)) {
          latestByType.set(insight.type, insight);
        }
      }

      set((state) => ({
        insights: { ...state.insights, [boardId]: Array.from(latestByType.values()) },
      }));
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    }
  },
  socketAddInsight: (insight: AIInsight) => {
    set((state) => {
      const current = state.insights[insight.boardId] || [];
      
      // We want to replace the existing insight of the same type, rather than appending
      const existingIndex = current.findIndex(i => i.type === insight.type);
      let newInsights;
      
      if (existingIndex >= 0) {
        newInsights = [...current];
        newInsights[existingIndex] = insight;
      } else {
        newInsights = [insight, ...current];
      }

      return {
        insights: { ...state.insights, [insight.boardId]: newInsights },
      };
    });
  },
}));
