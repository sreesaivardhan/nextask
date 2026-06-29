import { Search, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
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
  const { insights, isLoading, fetchInsights } = useInsightStore();

  useEffect(() => {
    fetchInsights(boardId);
  }, [boardId, fetchInsights]);

  const boardInsights = insights[boardId] || [];
  const loading = isLoading[boardId] ?? true;

  const sortedInsights = [...boardInsights].sort((a, b) => {
    const order: Record<string, number> = { BOTTLENECK: 1, SPRINT_RISK: 2, TASK_DEADLINE: 3 };
    const aOrder = order[a.type] || 4;
    const bOrder = order[b.type] || 4;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const topInsights = sortedInsights.filter(i => i.type === 'BOTTLENECK' || i.type === 'SPRINT_RISK');
  const taskInsights = sortedInsights.filter(i => i.type === 'TASK_DEADLINE');

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-status-success/10 text-status-success border border-status-success/30',
      MEDIUM: 'bg-status-warning/10 text-status-warning border border-status-warning/30',
      HIGH: 'bg-status-danger/10 text-status-danger border border-status-danger/30',
      ACTIVE: 'bg-primary/10 text-primary-accent border border-primary/30',
    };
    const badgeClass = colors[risk] || 'bg-elevated text-secondary border';
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>
        {risk}
      </span>
    );
  };

  const renderInsight = (insight: import('../stores/insightStore').AIInsight) => {
    if (insight.type === 'BOTTLENECK') {
      const severityStr = insight.data?.severityPercent !== undefined
        ? formatPercentage(insight.data.severityPercent as number, false)
        : formatPercentage(insight.data?.score as number, true);

      return (
        <div key={insight.id} className="p-3 bg-surface border border rounded-xl text-sm w-full">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-primary truncate pr-2 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-primary-accent shrink-0" /> {insight.title}
            </h3>
            {getRiskBadge('ACTIVE')}
          </div>

          {/* Metric row — neutral background, accent accent strip */}
          <div className="bg-background border rounded-lg p-2.5 mb-2.5 flex justify-between items-center">
            <span className="text-xs font-semibold text-secondary">Congestion</span>
            <span className="text-base font-black text-primary-accent">{severityStr}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-secondary mb-2">
            <div className="truncate"><strong className="text-primary">Column:</strong> {String(insight.data?.column)}</div>
            <div className="truncate"><strong className="text-primary">Cards:</strong> {String(insight.data?.cardCount)}</div>
          </div>

          <div className="text-xs text-secondary mb-2">
            <strong className="text-primary">Reason:</strong>
            <p className="mt-1 break-words text-secondary leading-relaxed">{String(insight.summary)}</p>
          </div>

          <div className="text-[11px] text-muted mt-2">
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
        <div key={insight.id} className="p-3 bg-surface border border rounded-xl text-sm w-full">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-primary truncate pr-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary-accent shrink-0" /> {insight.title}
            </h3>
            {getRiskBadge(risk)}
          </div>

          <div className="bg-background border rounded-lg p-2.5 mb-2.5 flex justify-between items-center">
            <span className="text-xs font-semibold text-secondary">Completion Confidence</span>
            <span className="text-base font-black text-primary">{compConfStr}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-secondary mb-2">
            <div className="truncate"><strong className="text-primary">Completed:</strong> {String(insight.data?.completedCards)}</div>
            <div className="truncate"><strong className="text-primary">Remaining:</strong> {String(insight.data?.remainingCards)}</div>
            <div className="col-span-2 truncate"><strong className="text-primary">Days Left:</strong> {String(insight.data?.remainingDays)}</div>
          </div>

          <div className="text-xs text-secondary mb-2">
            <strong className="text-primary">Reason:</strong>
            <p className="mt-1 break-words text-secondary leading-relaxed">{insight.summary}</p>
          </div>

          <div className="text-[11px] text-muted mt-2">
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
        <div key={insight.id} className="p-4 bg-surface border-l-[3px] border-l-status-warning border border rounded-xl text-sm w-full shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-status-warning truncate pr-2 flex items-center gap-1.5 text-base">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {insight.title}
            </h3>
            {getRiskBadge(risk)}
          </div>

          <div className="bg-status-warning/5 border border-status-warning/20 rounded-lg p-3 mb-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-secondary">Miss Probability</span>
            <span className="text-lg font-black text-status-warning">{missProbStr}</span>
          </div>

          <p className="text-primary mb-3 font-semibold break-words text-sm leading-relaxed">Task: {String(insight.data?.taskTitle)}</p>

          <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-xs text-secondary mb-3">
            <div><strong className="text-primary">Days Left:</strong> {String(insight.data?.daysRemaining)}</div>
            <div className="truncate"><strong className="text-primary">Column:</strong> {String(insight.data?.column)}</div>
            <div className="col-span-2 break-words"><strong className="text-primary">Assignee:</strong> {String(insight.data?.assignee)}</div>
          </div>

          {reasons && reasons.length > 0 && (
            <div className="text-xs text-secondary mb-2 bg-background p-2.5 rounded-lg border">
              <strong className="text-primary block mb-1">Reasons:</strong>
              <ul className="list-disc pl-4 space-y-1 break-words">
                {reasons.map((r, i) => (
                  <li key={i} className="leading-snug">{formatReason(r)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[11px] text-muted mt-3">
            {new Date(insight.createdAt).toLocaleString()}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-surface border border rounded-xl shadow-subtle flex flex-col w-80 shrink-0" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <div className="p-4 pb-3 border-b shrink-0 flex items-center justify-between">
        <h2 className="font-bold text-base text-primary">AI Insights</h2>
        <Sparkles className="w-4 h-4 text-primary-accent" />
      </div>

      {loading ? (
        <div className="p-4 space-y-3 flex-1">
          <div className="animate-pulse bg-elevated h-24 rounded-xl w-full"></div>
          <div className="animate-pulse bg-elevated h-24 rounded-xl w-full"></div>
          <div className="animate-pulse bg-elevated h-20 rounded-xl w-full"></div>
        </div>
      ) : sortedInsights.length === 0 ? (
        <div className="p-8 flex flex-col items-center justify-center text-center text-muted h-full gap-3">
          <Sparkles className="w-6 h-6 text-primary-accent opacity-50" />
          <p className="text-sm leading-relaxed">No insights generated yet. AI will automatically analyze your board shortly.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {topInsights.map(renderInsight)}
          {taskInsights.length > 0 && topInsights.length > 0 && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 pt-1">
              At-risk Tasks
            </div>
          )}
          {taskInsights.map(renderInsight)}
        </div>
      )}
    </div>
  );
}
