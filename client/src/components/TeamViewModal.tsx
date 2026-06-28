import { Users , Lightbulb , Clock } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-floating border border-strong w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-accent" /> Team View
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary font-bold text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
          {loading && !data ? (
            <div className="flex justify-center items-center w-full py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : data ? (
            <>
              {/* Left Column: Team Members & Stats */}
              <div className="flex-1 space-y-6 min-w-0">
                
                {/* Team Stats Summary */}
                <div className="bg-elevated p-4 rounded-xl border border flex flex-wrap justify-between gap-4">
                  <div className="text-center">
                    <div className="text-[11px] text-muted font-bold uppercase tracking-wide mb-1">Total Assigned</div>
                    <div className="text-2xl font-black text-primary">{data.teamStatistics.totalCardsAssigned}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-muted font-bold uppercase tracking-wide mb-1">Completion</div>
                    <div className="text-2xl font-black text-primary-accent">{data.teamStatistics.completionPercent.toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-muted font-bold uppercase tracking-wide mb-1">Avg Complexity</div>
                    <div className="text-2xl font-black text-primary">{data.teamStatistics.averageStoryPoints.toFixed(1)} <span className="text-base font-semibold text-muted">SP</span></div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-muted font-bold uppercase tracking-wide mb-1">Completed</div>
                    <div className="text-2xl font-black text-status-success">{data.teamStatistics.totalCardsCompleted}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] text-muted font-bold uppercase tracking-wide mb-1">In Progress</div>
                    <div className="text-2xl font-black text-status-warning">{data.teamStatistics.totalCardsInProgress}</div>
                  </div>
                </div>

                {/* AI Recommendations */}
                {data.aiRecommendations.length > 0 && (
                  <div className="bg-surface border-l-2 border-l-primary border border rounded-xl p-4">
                    <h3 className="font-bold text-primary flex items-center gap-2 mb-3 text-sm">
                      <Lightbulb className="w-4 h-4 text-status-warning" /> AI Workload Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {data.aiRecommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2 text-sm text-secondary">
                          <span className="text-primary-accent font-bold shrink-0 mt-0.5">&bull;</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Team Members List */}
                <div className="space-y-4">
                  {data.teamMembers.map(member => (
                    <div key={member.userId} className="bg-surface p-5 rounded-xl shadow-subtle border border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Avatar — bg-primary/10 so text-primary-accent is legible */}
                          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary-accent flex items-center justify-center font-bold text-lg shrink-0">
                            {member.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-primary">{member.displayName}</h3>
                            <div className="text-xs text-muted">{member.role}{member.email ? ` · ${member.email}` : ''}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-primary">WIP: {member.currentWIP}</div>
                          <div className="text-xs text-muted">Avg SP: {member.averageComplexity.toFixed(1)}</div>
                        </div>
                      </div>

                      {/* Task Stat Chips */}
                      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                        <div className="bg-elevated p-2 rounded-lg">
                          <div className="text-[11px] text-muted mb-0.5">Assigned</div>
                          <div className="font-bold text-primary text-sm">{member.assignedTasks}</div>
                        </div>
                        <div className="bg-status-success/5 border border-status-success/20 p-2 rounded-lg">
                          <div className="text-[11px] text-status-success mb-0.5">Done</div>
                          <div className="font-bold text-status-success text-sm">{member.completedTasks}</div>
                        </div>
                        <div className="bg-status-warning/5 border border-status-warning/20 p-2 rounded-lg">
                          <div className="text-[11px] text-status-warning mb-0.5">Active</div>
                          <div className="font-bold text-status-warning text-sm">{member.inProgressTasks}</div>
                        </div>
                        <div className="bg-status-danger/5 border border-status-danger/20 p-2 rounded-lg">
                          <div className="text-[11px] text-status-danger mb-0.5">Blocked</div>
                          <div className="font-bold text-status-danger text-sm">{member.blockedTasks}</div>
                        </div>
                      </div>

                      {/* Completion Rate Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                          <span className="text-secondary">Completion Rate</span>
                          <span className="text-primary-accent">{member.completionRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-elevated rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(member.completionRate, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Focus Labels & Last Active */}
                      <div className="mt-4 flex justify-between items-center text-xs gap-2 flex-wrap">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="text-muted font-medium">Focus:</span>
                          {member.topLabels.length > 0 ? (
                            member.topLabels.map(l => (
                              <span key={l} className="bg-elevated px-2 py-0.5 rounded-md text-secondary border border">{l}</span>
                            ))
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                        </div>
                        {member.lastActive && (
                          <div className="text-muted shrink-0">
                            Active: {new Date(member.lastActive).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Activity Timeline */}
              <div className="w-full md:w-72 bg-surface rounded-xl shadow-subtle border border p-4 flex flex-col md:max-h-[calc(90vh-8rem)] shrink-0">
                <h3 className="font-bold text-primary mb-4 flex items-center gap-2 text-sm sticky top-0 bg-surface pb-2 border-b border">
                  <Clock className="w-4 h-4 text-primary-accent" /> Recent Activity
                </h3>
                <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                  {data.activityTimeline.map(activity => (
                    <div key={activity.id} className="text-sm border-l-2 border-primary/20 pl-3 py-1">
                      <div className="font-semibold text-primary text-xs">{activity.user}</div>
                      <div className="text-secondary text-xs mt-0.5">
                        {activity.type === 'CARD_CREATED' && 'Created a card'}
                        {activity.type === 'CARD_UPDATED' && 'Updated a card'}
                        {activity.type === 'CARD_MOVED' && 'Moved a card'}
                        {activity.type === 'CARD_DELETED' && 'Deleted a card'}
                        {activity.type === 'GITHUB_IMPORT' && 'Imported from GitHub'}
                        {activity.type === 'MEMBER_JOINED' && 'Joined the board'}
                        {!['CARD_CREATED', 'CARD_UPDATED', 'CARD_MOVED', 'CARD_DELETED', 'GITHUB_IMPORT', 'MEMBER_JOINED'].includes(activity.type) && activity.type}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {new Date(activity.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {data.activityTimeline.length === 0 && (
                    <div className="text-muted text-sm text-center py-6">No recent activity.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center w-full py-20 text-muted">Failed to load team analytics.</div>
          )}
        </div>
      </div>
    </div>
  );
}
