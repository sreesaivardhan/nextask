import { useEffect } from 'react';
import { useInsightStore } from '../stores/insightStore';

interface AIInsightsPanelProps {
  boardId: string;
}

export function AIInsightsPanel({ boardId }: AIInsightsPanelProps) {
  const { insights, fetchInsights } = useInsightStore();

  useEffect(() => {
    fetchInsights(boardId);
  }, [boardId, fetchInsights]);

  const boardInsights = insights[boardId] || [];

  return (
    <div className="bg-white border rounded shadow-sm p-4 w-80 shrink-0 overflow-y-auto">
      <h2 className="font-bold text-lg mb-4 text-gray-800">AI Insights</h2>
      {boardInsights.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No insights generated yet.</p>
      ) : (
        <div className="space-y-4">
          {boardInsights.map((insight) => (
            <div key={insight.id} className="p-3 bg-blue-50 border border-blue-100 rounded text-sm">
              <h3 className="font-bold text-blue-800 mb-1">{insight.title}</h3>
              <p className="text-blue-700 mb-2">{insight.summary}</p>
              {insight.data?.score !== undefined && (
                <div className="text-xs text-blue-600 mb-1">
                  <strong>Score:</strong> {String(insight.data.score)}
                </div>
              )}
              {Boolean(insight.data?.reason) && (
                <div className="text-xs text-blue-600 mb-1">
                  <strong>Reason:</strong> {String(insight.data.reason)}
                </div>
              )}
              <div className="text-xs text-blue-400 mt-2">
                {new Date(insight.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
