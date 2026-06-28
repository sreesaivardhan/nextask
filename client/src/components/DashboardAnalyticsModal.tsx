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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

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
      // Quietly refetch without setting loading=true to prevent UI flashes
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📈 Dashboard Analytics
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          {loading && !data ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : data ? (
            <div className="space-y-8">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Total Cards" value={data.overview.totalCards} color="bg-gray-100" textColor="text-gray-800" />
                <StatCard title="Completion %" value={`${data.overview.completionPercent.toFixed(1)}%`} color="bg-blue-100" textColor="text-blue-800" />
                <StatCard title="Velocity" value={`${data.overview.currentVelocity.toFixed(1)} / day`} color="bg-green-100" textColor="text-green-800" />
                <StatCard title="Avg Complexity" value={`${data.overview.averageComplexity.toFixed(1)} SP`} color="bg-purple-100" textColor="text-purple-800" />
                
                <StatCard title="To Do" value={data.overview.todoCards} color="bg-yellow-100" textColor="text-yellow-800" />
                <StatCard title="In Progress" value={data.overview.inProgressCards} color="bg-orange-100" textColor="text-orange-800" />
                <StatCard title="Completed" value={data.overview.completedCards} color="bg-emerald-100" textColor="text-emerald-800" />
                <StatCard title="Blocked" value={data.overview.blockedCards} color="bg-red-100" textColor="text-red-800" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="font-bold text-gray-700 mb-4">Cards per Column</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.cardsPerColumn}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="font-bold text-gray-700 mb-4">Velocity Trend (Weekly)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.charts.velocityTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <RechartsTooltip />
                        <Area type="monotone" dataKey="velocity" stroke="#10b981" fill="#d1fae5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border">
                  <h3 className="font-bold text-gray-700 mb-4">Workload Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.workloadDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow border flex flex-col">
                  <h3 className="font-bold text-gray-700 mb-4">Complexity Distribution</h3>
                  <div className="h-64 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.charts.complexityDistribution} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                          {data.charts.complexityDistribution.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">🤖 AI Summary & Recommendations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-600 mb-2">Board Health</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">Top Blocked Column:</span>
                        <span className="font-medium">{data.aiSummary.topBlockedColumn}</span>
                      </li>
                      <li className="flex justify-between py-1 border-b">
                        <span className="text-gray-500">Highest WIP Column:</span>
                        <span className="font-medium">{data.aiSummary.highestWIPColumn}</span>
                      </li>
                      {data.aiSummary.sprintRisk && (
                        <li className="flex justify-between py-1 border-b">
                          <span className="text-gray-500">Sprint Risk Level:</span>
                          <span className="font-bold text-red-600">
                            {(data.aiSummary.sprintRisk as { risk: string }).risk} 
                            ({(data.aiSummary.sprintRisk as { completionConfidence: number }).completionConfidence}% confidence)
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-600 mb-2">Recent Insights</h4>
                    {data.aiSummary.bottleneck && (
                      <div className="bg-orange-50 border border-orange-100 p-3 rounded text-sm mb-3 text-orange-800">
                        <strong>Bottleneck Detected:</strong> Reduce WIP in {(data.aiSummary.bottleneck as { column: string }).column}.
                      </div>
                    )}
                    {data.aiSummary.latestDigest && (
                      <div className="bg-purple-50 border border-purple-100 p-3 rounded text-sm text-purple-800">
                        <strong>Weekly Digest:</strong> Trend is {(data.aiSummary.latestDigest as { velocityTrend: string }).velocityTrend}. 
                        Velocity: {(data.aiSummary.latestDigest as { currentVelocity: number }).currentVelocity.toFixed(1)}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">Failed to load analytics.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color, textColor }: { title: string, value: string | number, color: string, textColor: string }) {
  return (
    <div className={`${color} p-4 rounded-lg shadow-sm border border-black/5`}>
      <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${textColor} opacity-70`}>{title}</div>
      <div className={`text-2xl font-black ${textColor}`}>{value}</div>
    </div>
  );
}
