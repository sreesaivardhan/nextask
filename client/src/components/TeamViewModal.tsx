import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socketService';
import { useToastStore } from '../stores/toastStore';

interface TeamViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

interface TeamMemberAnalytics {
  userId: string;
  displayName: string;
  email: string | null;
  githubUsername: string | null;
  role: string;
  assignedTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  currentWIP: number;
  averageComplexity: number;
  completionRate: number;
  topLabels: string[];
  lastActive: string | null;
}

interface ActivityTimeline {
  id: string;
  user: string;
  type: string;
  entityType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface TeamAnalyticsData {
  teamMembers: TeamMemberAnalytics[];
  teamStatistics: {
    totalCardsAssigned: number;
    totalCardsCompleted: number;
    totalCardsInProgress: number;
    averageStoryPoints: number;
    completionPercent: number;
  };
  aiRecommendations: string[];
  activityTimeline: ActivityTimeline[];
}

export function TeamViewModal({ isOpen, onClose, boardId }: TeamViewModalProps) {
  const [data, setData] = useState<TeamAnalyticsData | null>(null);
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

  const fetchTeamAnalytics = useCallback(() => {
    api.get(`/analytics/boards/${boardId}/team`)
      .then((res) => {
        setData(res as TeamAnalyticsData);
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch team analytics';
        addToast(errorMessage, 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [boardId, addToast]);

  useEffect(() => {
    if (isOpen && loading) {
      fetchTeamAnalytics();
    }
  }, [isOpen, loading, fetchTeamAnalytics]);

  // Realtime updates
  useEffect(() => {
    if (!isOpen) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const refetch = () => {
      fetchTeamAnalytics();
    };

    socket.on('card:created', refetch);
    socket.on('card:updated', refetch);
    socket.on('card:deleted', refetch);
    socket.on('card:moved', refetch);
    socket.on('board:members_updated', refetch);
    socket.on('activity:created', refetch);

    return () => {
      socket.off('card:created', refetch);
      socket.off('card:updated', refetch);
      socket.off('card:deleted', refetch);
      socket.off('card:moved', refetch);
      socket.off('board:members_updated', refetch);
      socket.off('activity:created', refetch);
    };
  }, [isOpen, fetchTeamAnalytics]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-100 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-white">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            👥 Team View
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
          {loading && !data ? (
            <div className="flex justify-center items-center w-full py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : data ? (
            <>
              {/* Left Column: Team Members & Stats */}
              <div className="flex-1 space-y-6">
                
                {/* Team Stats */}
                <div className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
                  <div className="text-center px-4">
                    <div className="text-sm text-gray-500 font-semibold uppercase">Total Assigned</div>
                    <div className="text-2xl font-black text-gray-800">{data.teamStatistics.totalCardsAssigned}</div>
                  </div>
                  <div className="text-center px-4 border-l">
                    <div className="text-sm text-gray-500 font-semibold uppercase">Completion</div>
                    <div className="text-2xl font-black text-blue-600">{data.teamStatistics.completionPercent.toFixed(1)}%</div>
                  </div>
                  <div className="text-center px-4 border-l">
                    <div className="text-sm text-gray-500 font-semibold uppercase">Avg Complexity</div>
                    <div className="text-2xl font-black text-purple-600">{data.teamStatistics.averageStoryPoints.toFixed(1)} SP</div>
                  </div>
                </div>

                {/* AI Recommendations */}
                {data.aiRecommendations.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2">
                      💡 AI Workload Recommendations
                    </h3>
                    <ul className="list-disc pl-5 space-y-1 text-blue-900 text-sm">
                      {data.aiRecommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Team Members List */}
                <div className="space-y-4">
                  {data.teamMembers.map(member => (
                    <div key={member.userId} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                            {member.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">{member.displayName}</h3>
                            <div className="text-xs text-gray-500 font-medium">{member.role} • {member.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-700">WIP: {member.currentWIP}</div>
                          <div className="text-xs text-gray-500">Avg SP: {member.averageComplexity.toFixed(1)}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-4 gap-4 text-center">
                        <div className="bg-gray-50 p-2 rounded">
                          <div className="text-xs text-gray-500">Assigned</div>
                          <div className="font-bold">{member.assignedTasks}</div>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <div className="text-xs text-green-600">Completed</div>
                          <div className="font-bold text-green-700">{member.completedTasks}</div>
                        </div>
                        <div className="bg-orange-50 p-2 rounded">
                          <div className="text-xs text-orange-600">In Progress</div>
                          <div className="font-bold text-orange-700">{member.inProgressTasks}</div>
                        </div>
                        <div className="bg-red-50 p-2 rounded">
                          <div className="text-xs text-red-600">Blocked</div>
                          <div className="font-bold text-red-700">{member.blockedTasks}</div>
                        </div>
                      </div>

                      {/* Workload Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-gray-600">Completion Rate</span>
                          <span className="text-blue-600">{member.completionRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(member.completionRate, 100)}%` }}></div>
                        </div>
                      </div>

                      {/* Specializations & Active */}
                      <div className="mt-4 flex justify-between items-center text-xs">
                        <div className="flex gap-2">
                          <span className="text-gray-500 font-medium">Focus:</span>
                          {member.topLabels.length > 0 ? (
                            member.topLabels.map(l => <span key={l} className="bg-gray-200 px-2 py-0.5 rounded text-gray-700">{l}</span>)
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </div>
                        {member.lastActive && (
                          <div className="text-gray-400">
                            Active: {new Date(member.lastActive).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Activity Timeline */}
              <div className="w-full md:w-80 bg-white rounded-lg shadow-sm border p-4 flex flex-col h-full md:max-h-[calc(100vh-12rem)]">
                <h3 className="font-bold text-gray-800 mb-4 sticky top-0 bg-white">⏱️ Recent Activity</h3>
                <div className="overflow-y-auto flex-1 pr-2 space-y-4">
                  {data.activityTimeline.map(activity => (
                    <div key={activity.id} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                      <div className="font-semibold text-gray-700">{activity.user}</div>
                      <div className="text-gray-600">
                        {activity.type === 'CARD_CREATED' && 'Created a card'}
                        {activity.type === 'CARD_UPDATED' && 'Updated a card'}
                        {activity.type === 'CARD_MOVED' && 'Moved a card'}
                        {activity.type === 'CARD_DELETED' && 'Deleted a card'}
                        {activity.type === 'GITHUB_IMPORT' && 'Imported from GitHub'}
                        {activity.type === 'MEMBER_JOINED' && 'Joined the board'}
                        {!['CARD_CREATED', 'CARD_UPDATED', 'CARD_MOVED', 'CARD_DELETED', 'GITHUB_IMPORT', 'MEMBER_JOINED'].includes(activity.type) && activity.type}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {data.activityTimeline.length === 0 && (
                    <div className="text-gray-500 text-sm text-center py-4">No recent activity.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center w-full py-20 text-gray-500">Failed to load team analytics.</div>
          )}
        </div>
      </div>
    </div>
  );
}
