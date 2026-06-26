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
  socketRemoveInsight: (insightId: string, boardId: string) => void;
}

export const useInsightStore = create<InsightStore>((set) => ({
  insights: {},
  fetchInsights: async (boardId: string) => {
    try {
      const data = await api.get(`/boards/${boardId}/ai-insights`);
      
      // The backend returns insights ordered by createdAt DESC.
      // We want to keep the latest insight for BOTTLENECK and SPRINT_RISK,
      // and the latest insight PER TASK for TASK_DEADLINE.
      const latestByKey = new Map<string, AIInsight>();
      
      for (const insight of data) {
        let key = insight.type;
        if (insight.type === 'TASK_DEADLINE' && insight.data?.taskId) {
          key = `TASK_DEADLINE_${insight.data.taskId}`;
        }
        
        if (!latestByKey.has(key)) {
          latestByKey.set(key, insight);
        }
      }

      set((state) => ({
        insights: { ...state.insights, [boardId]: Array.from(latestByKey.values()) },
      }));
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    }
  },
  socketAddInsight: (insight: AIInsight) => {
    set((state) => {
      const current = state.insights[insight.boardId] || [];
      
      // For BOTTLENECK and SPRINT_RISK, replace by type.
      // For TASK_DEADLINE, replace by taskId.
      const existingIndex = current.findIndex(i => {
        if (insight.type === 'TASK_DEADLINE') {
          return i.type === 'TASK_DEADLINE' && i.data?.taskId === insight.data?.taskId;
        }
        return i.type === insight.type;
      });
      
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
  socketRemoveInsight: (insightId: string, boardId: string) => {
    set((state) => {
      const current = state.insights[boardId] || [];
      const filtered = current.filter(i => i.id !== insightId);
      return {
        insights: { ...state.insights, [boardId]: filtered },
      };
    });
  },
}));
