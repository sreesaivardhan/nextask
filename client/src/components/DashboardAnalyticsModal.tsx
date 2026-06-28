import { BarChart3 , BrainCircuit } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socketService';
import { useToastStore } from '../stores/toastStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

interface DashboardAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

interface AnalyticsData {
  overview: {
    totalCards: number;
    completedCards: number;
    inProgressCards: number;
    todoCards: number;
    blockedCards: number;
    completionPercent: number;
    currentVelocity: number;
    averageComplexity: number;
  };
  charts: {
    cardsPerColumn: { name: string; count: number }[];
    workloadDistribution: { name: string; count: number }[];
    complexityDistribution: { name: string; value: number }[];
    velocityTrend: { date: string; velocity: number }[];
  };
  aiSummary: {
    bottleneck: Record<string, unknown> | null;
    sprintRisk: Record<string, unknown> | null;
    latestDigest: Record<string, unknown> | null;
    topBlockedColumn: string;
    highestWIPColumn: string;
  };
}

// Semantic palette anchored to CSS vars — readable in both light/dark
const CHART_COLORS = [
  'var(--accent-primary)',
  'var(--status-success)',
  'var(--status-warning)',
  'var(--status-danger)',
  'var(--status-info)',
  '#8884d8',
  '#82ca9d',
];

export function DashboardAnalyticsModal({ isOpen, onClose, boardId }: DashboardAnalyticsModalProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      setData(null);
    }
  }

  const fetchAnalytics = useCallback(() => {
    api.get(`/analytics/boards/${boardId}/dashboard`)
      .then((res) => {
        setData(res as AnalyticsData);
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard analytics';
        addToast(errorMessage, 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [boardId, addToast]);

  useEffect(() => {
    if (isOpen && loading) {
      fetchAnalytics();
    }
  }, [isOpen, loading, fetchAnalytics]);

  // Realtime updates
  useEffect(() => {
    if (!isOpen) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const refetch = () => {
      fetchAnalytics();
    };

    socket.on('card:created', refetch);
    socket.on('card:updated', refetch);
    socket.on('card:deleted', refetch);
    socket.on('card:moved', refetch);
    socket.on('ai:digest', refetch);
    socket.on('ai:insight', refetch);

    return () => {
      socket.off('card:created', refetch);
      socket.off('card:updated', refetch);
      socket.off('card:deleted', refetch);
      socket.off('card:moved', refetch);
      socket.off('ai:digest', refetch);
      socket.off('ai:insight', refetch);
    };
  }, [isOpen, fetchAnalytics]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-floating w-full max-w-6xl max-h-[90vh] flex flex-col border border-strong">
        {/* Header */}
        <div className="px-6 py-4 border-b border flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-accent" /> Dashboard Analytics
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary font-bold text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading && !data ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : data ? (
            <div className="space-y-8">
              {/* Overview Cards — neutral bg, accent is only border/label */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total Cards" value={data.overview.totalCards} accentColor="border-l-primary" />
                  <StatCard title="Completion" value={`${data.overview.completionPercent.toFixed(1)}%`} accentColor="border-l-status-success" />
                  <StatCard title="Velocity" value={`${data.overview.currentVelocity.toFixed(1)}/day`} accentColor="border-l-status-info" />
                  <StatCard title="Avg Complexity" value={`${data.overview.averageComplexity.toFixed(1)} SP`} accentColor="border-l-primary" />

                  <StatCard title="To Do" value={data.overview.todoCards} accentColor="border-l-elevated" />
                  <StatCard title="In Progress" value={data.overview.inProgressCards} accentColor="border-l-status-warning" />
                  <StatCard title="Completed" value={data.overview.completedCards} accentColor="border-l-status-success" />
                  <StatCard title="Blocked" value={data.overview.blockedCards} accentColor="border-l-status-danger" />
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface p-4 rounded-xl shadow-subtle border border">
                  <h3 className="font-semibold text-primary mb-4 text-sm">Cards per Column</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.cardsPerColumn}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-surface p-4 rounded-xl shadow-subtle border border">
                  <h3 className="font-semibold text-primary mb-4 text-sm">Velocity Trend (Weekly)</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.charts.velocityTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Area type="monotone" dataKey="velocity" stroke="var(--status-success)" fill="var(--status-success)" fillOpacity={0.12} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-surface p-4 rounded-xl shadow-subtle border border">
                  <h3 className="font-semibold text-primary mb-4 text-sm">Workload Distribution</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.workloadDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Bar dataKey="count" fill="var(--status-info)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-surface p-4 rounded-xl shadow-subtle border border flex flex-col">
                  <h3 className="font-semibold text-primary mb-4 text-sm">Complexity Distribution</h3>
                  <div className="h-56 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.charts.complexityDistribution} cx="50%" cy="50%" outerRadius={75} dataKey="value" label>
                          {data.charts.complexityDistribution.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              <div className="bg-surface p-6 rounded-xl shadow-subtle border border">
                <h3 className="font-bold text-primary text-base mb-4 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-primary-accent" /> AI Summary & Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-secondary mb-3 text-sm">Board Health</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between py-2 border-b border">
                        <span className="text-muted">Top Blocked Column</span>
                        <span className="font-semibold text-primary">{data.aiSummary.topBlockedColumn}</span>
                      </li>
                      <li className="flex justify-between py-2 border-b border">
                        <span className="text-muted">Highest WIP Column</span>
                        <span className="font-semibold text-primary">{data.aiSummary.highestWIPColumn}</span>
                      </li>
                      {data.aiSummary.sprintRisk && (
                        <li className="flex justify-between py-2 border-b border">
                          <span className="text-muted">Sprint Risk Level</span>
                          <span className="font-bold text-status-danger">
                            {(data.aiSummary.sprintRisk as { risk: string }).risk} 
                            {' '}({(data.aiSummary.sprintRisk as { completionConfidence: number }).completionConfidence}% confidence)
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-secondary mb-3 text-sm">Recent Insights</h4>
                    <div className="space-y-2">
                      {data.aiSummary.bottleneck && (
                        <div className="bg-status-warning/5 border border-status-warning/20 p-3 rounded-xl text-sm">
                          <p className="text-primary font-semibold mb-0.5">Bottleneck Detected</p>
                          <p className="text-secondary">Reduce WIP in <strong>{(data.aiSummary.bottleneck as { column: string }).column}</strong>.</p>
                        </div>
                      )}
                      {data.aiSummary.latestDigest && (
                        <div className="bg-elevated border border p-3 rounded-xl text-sm">
                          <p className="text-primary font-semibold mb-0.5">Weekly Digest</p>
                          <p className="text-secondary">
                            Trend is <strong>{(data.aiSummary.latestDigest as { velocityTrend: string }).velocityTrend}</strong>. 
                            {' '}Velocity: {(data.aiSummary.latestDigest as { currentVelocity: number }).currentVelocity.toFixed(1)}.
                          </p>
                        </div>
                      )}
                      {!data.aiSummary.bottleneck && !data.aiSummary.latestDigest && (
                        <p className="text-muted text-sm italic">No recent AI insights available.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-muted">Failed to load analytics.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// StatCard — neutral bg, readable text, coloured left border accent only
function StatCard({ title, value, accentColor }: { title: string; value: string | number; accentColor: string }) {
  return (
    <div className={`bg-surface p-4 rounded-xl shadow-subtle border-l-2 border border ${accentColor}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">{title}</div>
      <div className="text-2xl font-black text-primary">{value}</div>
    </div>
  );
}
