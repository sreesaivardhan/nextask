import { useEffect } from 'react';
import { useInsightStore } from '../stores/insightStore';

interface AIInsightsPanelProps {
  boardId: string;
}

const formatPercentage = (value: number | string | undefined, isDecimal: boolean = false) => {
  if (value === undefined || value === null) return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  let percent = isDecimal ? num * 100 : num;
  percent = Math.max(0, Math.min(100, percent));
  return Math.round(percent) + '%';
};

const formatReason = (reason: string) => {
  const text = reason.replace(/\s*\([+-]\d+\)/g, '').trim();
  if (text.includes('Sprint HIGH')) return 'Sprint is currently HIGH risk.';
  if (text.includes('Sprint MEDIUM')) return 'Sprint is currently MEDIUM risk.';
  if (text.includes('Todo column') || text.includes('First column') || text.includes('Still in')) return 'Task is still in the Todo column.';
  if (text.includes('Doing column') || text.includes('Second column')) return 'Task is currently in progress.';
  if (text.includes('Recently created')) return 'Task was created recently.';
  if (text.includes('Recently worked on') || text.includes('Recently updated')) return 'Task was updated recently.';
  if (text.includes('Assignee overloaded') || text.includes('Assignee has')) return 'Assignee has multiple active tasks.';
  if (text.includes('Remaining')) return 'Sprint deadline is approaching.';
  if (text.includes('Idle')) return 'Task has been idle for an extended period.';
  return text;
};

export function AIInsightsPanel({ boardId }: AIInsightsPanelProps) {
  const { insights, fetchInsights } = useInsightStore();

  useEffect(() => {
    fetchInsights(boardId);
  }, [boardId, fetchInsights]);

  const boardInsights = insights[boardId] || [];
  
  const sortedInsights = [...boardInsights].sort((a, b) => {
    const order: Record<string, number> = { BOTTLENECK: 1, SPRINT_RISK: 2, TASK_DEADLINE: 3 };
    const aOrder = order[a.type] || 4;
    const bOrder = order[b.type] || 4;
    
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-green-100 text-green-800 border-green-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      HIGH: 'bg-red-100 text-red-800 border-red-200',
      ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    const badgeClass = colors[risk] || 'bg-gray-100 text-gray-800 border-gray-200';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${badgeClass}`}>
        {risk}
      </span>
    );
  };

  return (
    <div className="bg-white border rounded shadow-sm p-4 w-80 shrink-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <h2 className="font-bold text-lg mb-4 text-gray-800">AI Insights</h2>
      {sortedInsights.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No insights generated yet.</p>
      ) : (
        <div className="space-y-4">
          {sortedInsights.map((insight) => {
            if (insight.type === 'BOTTLENECK') {
              const severityStr = insight.data?.severityPercent !== undefined 
                ? formatPercentage(insight.data.severityPercent as number, false)
                : formatPercentage(insight.data?.score as number, true);

              return (
                <div key={insight.id} className="p-3 bg-blue-50 border border-blue-100 rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-blue-800">🔍 {insight.title}</h3>
                    {getRiskBadge('ACTIVE')}
                  </div>
                  
                  <div className="bg-blue-100 p-2 rounded mb-2 flex justify-between items-center text-blue-800 font-bold">
                    <span>Congestion:</span>
                    <span>{severityStr}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-600 mb-2">
                    <div><strong>Column:</strong> {String(insight.data?.column)}</div>
                    <div><strong>Cards:</strong> {String(insight.data?.cardCount)}</div>
                  </div>
                  
                  <div className="text-xs text-blue-600 mb-2">
                    <strong>Reason:</strong>
                    <p className="mt-1">{String(insight.summary)}</p>
                  </div>

                  <div className="text-xs text-blue-400 mt-2">
                    {new Date(insight.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            }

            if (insight.type === 'SPRINT_RISK') {
              const risk = String(insight.data?.risk || 'UNKNOWN');
              
              let compConfStr = '';
              if (insight.data?.completionConfidence !== undefined) {
                compConfStr = formatPercentage(insight.data.completionConfidence as number, false);
              } else if (insight.data?.velocity !== undefined && insight.data?.requiredVelocity !== undefined) {
                const vel = Number(insight.data.velocity);
                const req = Number(insight.data.requiredVelocity);
                const ratio = req === 0 ? 1 : vel / req;
                compConfStr = formatPercentage(ratio, true);
              }

              return (
                <div key={insight.id} className="p-3 bg-purple-50 border border-purple-100 rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-purple-800">📈 {insight.title}</h3>
                    {getRiskBadge(risk)}
                  </div>
                  
                  <div className="bg-purple-100 p-2 rounded mb-2 flex justify-between items-center text-purple-800 font-bold">
                    <span>Completion Confidence:</span>
                    <span>{compConfStr}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-purple-600 mb-2">
                    <div><strong>Completed:</strong> {String(insight.data?.completedCards)}</div>
                    <div><strong>Remaining:</strong> {String(insight.data?.remainingCards)}</div>
                    <div className="col-span-2"><strong>Days Left:</strong> {String(insight.data?.remainingDays)}</div>
                  </div>
                  
                  <div className="text-xs text-purple-600 mb-2">
                    <strong>Reason:</strong>
                    <p className="mt-1">{insight.summary}</p>
                  </div>

                  <div className="text-xs text-purple-400 mt-2">
                    {new Date(insight.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            }

            if (insight.type === 'TASK_DEADLINE') {
              const risk = String(insight.data?.risk || 'UNKNOWN');
              const reasons = insight.data?.reasons as string[] | undefined;
              
              const missProbStr = insight.data?.confidence !== undefined
                ? formatPercentage(insight.data.confidence as number, false)
                : formatPercentage((insight.data?.score as number) / 15, true);

              return (
                <div key={insight.id} className="p-3 bg-orange-50 border border-orange-100 rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-orange-800">⚠️ {insight.title}</h3>
                    {getRiskBadge(risk)}
                  </div>
                  
                  <div className="bg-orange-100 p-2 rounded mb-2 flex justify-between items-center text-orange-800 font-bold">
                    <span>Miss Probability:</span>
                    <span>{missProbStr}</span>
                  </div>
                  
                  <p className="text-orange-700 mb-2 font-semibold">Task: {String(insight.data?.taskTitle)}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-orange-600 mb-2">
                    <div><strong>Days Left:</strong> {String(insight.data?.daysRemaining)}</div>
                    <div><strong>Column:</strong> {String(insight.data?.column)}</div>
                    <div className="col-span-2"><strong>Assignee:</strong> {String(insight.data?.assignee)}</div>
                  </div>

                  {reasons && reasons.length > 0 && (
                    <div className="text-xs text-orange-600 mb-2">
                      <strong>Reasons:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {reasons.map((r, i) => (
                          <li key={i}>{formatReason(r)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-xs text-orange-400 mt-2">
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
