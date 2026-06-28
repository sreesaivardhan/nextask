import { PrismaClient } from '@prisma/client';
import { authzService } from './authorization.service';

const prisma = new PrismaClient();

export class AnalyticsService {
  async getDashboardAnalytics(boardId: string, userId: string): Promise<Record<string, unknown>> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          include: {
            cards: {
              include: {
                assignee: true,
                labels: { include: { label: true } }
              }
            }
          }
        },
        aiInsights: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        weeklyDigests: {
          orderBy: { generatedAt: 'desc' },
          take: 8
        },
        members: {
          include: { user: true }
        }
      }
    });

    if (!board) throw new Error('Board not found');

    const completionNames = ['done', 'completed', 'complete', 'finished', 'closed', 'resolved'];
    const blockedNames = ['blocked', 'impediment'];
    const todoNames = ['todo', 'to do', 'backlog', 'open', 'new'];

    let totalCards = 0;
    let completedCards = 0;
    let inProgressCards = 0;
    let todoCards = 0;
    let blockedCards = 0;

    let totalComplexity = 0;
    let complexityCount = 0;

    const cardsPerColumn: { name: string; count: number }[] = [];
    const workloadDistributionMap = new Map<string, number>();
    const complexityDistributionMap = new Map<number, number>();

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let cardsCompletedLast7Days = 0;

    for (const column of board.columns) {
      const colName = column.name.toLowerCase();
      const isCompleted = completionNames.includes(colName);
      const isBlocked = blockedNames.includes(colName);
      const isTodo = todoNames.includes(colName) || column.position === 0;

      cardsPerColumn.push({ name: column.name, count: column.cards.length });

      for (const card of column.cards) {
        totalCards++;
        if (isCompleted) {
          completedCards++;
          if (new Date(card.updatedAt) >= oneWeekAgo) {
            cardsCompletedLast7Days++;
          }
        } else if (isBlocked) {
          blockedCards++;
        } else if (isTodo) {
          todoCards++;
        } else {
          inProgressCards++;
        }

        if (card.complexity) {
          totalComplexity += card.complexity;
          complexityCount++;
          const currentCompCount = complexityDistributionMap.get(card.complexity) || 0;
          complexityDistributionMap.set(card.complexity, currentCompCount + 1);
        }

        if (!isCompleted && card.assignee) {
          const currentCount = workloadDistributionMap.get(card.assignee.displayName) || 0;
          workloadDistributionMap.set(card.assignee.displayName, currentCount + 1);
        }
      }
    }

    const completionPercent = totalCards > 0 ? (completedCards / totalCards) * 100 : 0;
    const currentVelocity = cardsCompletedLast7Days / 7;
    const averageComplexity = complexityCount > 0 ? totalComplexity / complexityCount : 0;

    // Charts formatting
    const workloadDistribution = Array.from(workloadDistributionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const complexityDistribution = Array.from(complexityDistributionMap.entries())
      .map(([complexity, count]) => ({ name: `${complexity} SP`, value: count }))
      .sort((a, b) => parseInt(a.name) - parseInt(b.name));

    const velocityTrend = [...board.weeklyDigests]
      .reverse()
      .map(d => ({
        date: new Date(d.generatedAt).toLocaleDateString(),
        velocity: d.currentVelocity
      }));

    // AI
    const bottleneckInsight = board.aiInsights.find(i => i.type === 'BOTTLENECK');
    const sprintRiskInsight = board.aiInsights.find(i => i.type === 'SPRINT_RISK');
    const latestDigest = board.weeklyDigests[0] || null;

    let topBlockedColumn = 'None';
    let highestWIPColumn = 'None';
    let maxWip = 0;

    for (const column of board.columns) {
      if (blockedNames.includes(column.name.toLowerCase())) {
        topBlockedColumn = column.name;
      }
      const wipCount = column.cards.filter(() => !completionNames.includes(column.name.toLowerCase())).length;
      if (wipCount > maxWip) {
        maxWip = wipCount;
        highestWIPColumn = column.name;
      }
    }

    return {
      overview: {
        totalCards,
        completedCards,
        inProgressCards,
        todoCards,
        blockedCards,
        completionPercent,
        currentVelocity,
        averageComplexity,
      },
      charts: {
        cardsPerColumn,
        workloadDistribution,
        complexityDistribution,
        velocityTrend
      },
      aiSummary: {
        bottleneck: bottleneckInsight?.data || null,
        sprintRisk: sprintRiskInsight?.data || null,
        latestDigest,
        topBlockedColumn,
        highestWIPColumn
      }
    };
  }

  async getTeamAnalytics(boardId: string, userId: string): Promise<Record<string, unknown>> {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          include: { user: true }
        },
        columns: {
          include: {
            cards: {
              include: {
                labels: { include: { label: true } }
              }
            }
          }
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 200
        }
      }
    });

    if (!board) throw new Error('Board not found');

    const completionNames = ['done', 'completed', 'complete', 'finished', 'closed', 'resolved'];
    const blockedNames = ['blocked', 'impediment'];

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
      lastActive: Date | null;
    }

    const teamMembers: TeamMemberAnalytics[] = [];
    const aiRecommendations: string[] = [];

    let totalCardsAssigned = 0;
    let totalCardsCompleted = 0;
    let totalCardsInProgress = 0;

    for (const member of board.members) {
      const userCards = board.columns.flatMap(col => col.cards).filter(c => c.assigneeId === member.userId);
      const assigned = userCards.length;
      let completed = 0;
      let inProgress = 0;
      let blocked = 0;
      let memberComplexitySum = 0;
      let memberComplexityCount = 0;

      const labelsMap = new Map<string, number>();

      for (const card of userCards) {
        const col = board.columns.find(c => c.id === card.columnId);
        const colName = col ? col.name.toLowerCase() : '';
        if (completionNames.includes(colName)) {
          completed++;
        } else if (blockedNames.includes(colName)) {
          blocked++;
        } else {
          inProgress++;
        }

        if (card.complexity) {
          memberComplexitySum += card.complexity;
          memberComplexityCount++;
        }

        for (const cl of card.labels) {
          const current = labelsMap.get(cl.label.name) || 0;
          labelsMap.set(cl.label.name, current + 1);
        }
      }

      totalCardsAssigned += assigned;
      totalCardsCompleted += completed;
      totalCardsInProgress += inProgress;

      const completionRate = assigned > 0 ? (completed / assigned) * 100 : 0;
      const avgComplexity = memberComplexityCount > 0 ? memberComplexitySum / memberComplexityCount : 0;

      const topLabels = Array.from(labelsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0]);

      // Last active from activity log
      const lastActiveLog = board.activityLogs.find(log => log.userId === member.userId);
      const lastActive = lastActiveLog ? lastActiveLog.createdAt : null;

      teamMembers.push({
        userId: member.userId,
        displayName: member.user.displayName,
        email: member.user.email,
        githubUsername: member.user.githubUsername,
        role: member.role,
        assignedTasks: assigned,
        completedTasks: completed,
        inProgressTasks: inProgress,
        blockedTasks: blocked,
        currentWIP: inProgress,
        averageComplexity: avgComplexity,
        completionRate,
        topLabels,
        lastActive
      });

      // Basic AI logic for recommendations (based on historical data, as requested)
      if (inProgress > 5) {
        aiRecommendations.push(`${member.user.displayName} appears overloaded with ${inProgress} tasks in progress.`);
      }
      if (inProgress === 0 && assigned > 0) {
        aiRecommendations.push(`${member.user.displayName} has no current WIP but has assigned tasks. Consider starting work.`);
      }
    }

    // sort team members by WIP to find lowest WIP
    teamMembers.sort((a, b) => a.currentWIP - b.currentWIP);
    if (teamMembers.length > 0 && teamMembers[0].currentWIP === 0) {
      aiRecommendations.push(`${teamMembers[0].displayName} has the lowest WIP and can take on new tasks.`);
    }

    // Format activity timeline
    const activityTimeline = board.activityLogs.slice(0, 50).map(log => {
      const user = board.members.find(m => m.userId === log.userId)?.user;
      return {
        id: log.id,
        user: user ? user.displayName : 'System / Unknown',
        type: log.type,
        entityType: log.entityType,
        createdAt: log.createdAt,
        metadata: log.metadata
      };
    });

    const teamStatistics = {
      totalCardsAssigned,
      totalCardsCompleted,
      totalCardsInProgress,
      averageStoryPoints: totalCardsAssigned > 0 ? teamMembers.reduce((acc, m) => acc + m.averageComplexity, 0) / teamMembers.length : 0,
      completionPercent: totalCardsAssigned > 0 ? (totalCardsCompleted / totalCardsAssigned) * 100 : 0
    };

    return {
      teamMembers,
      teamStatistics,
      aiRecommendations,
      activityTimeline
    };
  }
}

export const analyticsService = new AnalyticsService();
