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
          {boardInsights.map((insight) => {
            if (insight.type === 'BOTTLENECK') {
              return (
                <div key={insight.id} className="p-3 bg-blue-50 border border-blue-100 rounded text-sm">
                  <h3 className="font-bold text-blue-800 mb-1">🔍 {insight.title}</h3>
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
              );
            }

            if (insight.type === 'SPRINT_RISK') {
              const risk = String(insight.data?.risk || 'UNKNOWN');
              const riskColors: Record<string, string> = {
                LOW: 'bg-green-100 text-green-800 border-green-200',
                MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                HIGH: 'bg-red-100 text-red-800 border-red-200',
              };
              const badgeClass = riskColors[risk] || 'bg-gray-100 text-gray-800 border-gray-200';

              return (
                <div key={insight.id} className="p-3 bg-purple-50 border border-purple-100 rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-purple-800">📈 {insight.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${badgeClass}`}>
                      {risk}
                    </span>
                  </div>
                  <p className="text-purple-700 mb-2">{insight.summary}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-purple-600 mb-2">
                    <div><strong>Velocity:</strong> {String(insight.data?.velocity)}</div>
                    <div><strong>Required:</strong> {String(insight.data?.requiredVelocity)}</div>
                    <div><strong>Completed:</strong> {String(insight.data?.completedCards)}</div>
                    <div><strong>Remaining:</strong> {String(insight.data?.remainingCards)}</div>
                    <div className="col-span-2"><strong>Days Left:</strong> {String(insight.data?.remainingDays)}</div>
                  </div>
                  <div className="text-xs text-purple-400 mt-2">
                    {new Date(insight.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}
