import { PrismaClient, Prisma } from '@prisma/client';
import { getIO } from '../socket';

interface BottleneckData extends Prisma.JsonObject {
  column: string;
  unassignedCount: number;
}

interface RiskSummaryData extends Prisma.JsonObject {
  risk: string;
  completionConfidence: number;
}

function isBottleneckData(data: Prisma.JsonValue): data is BottleneckData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  return typeof data.column === 'string' && typeof data.unassignedCount === 'number';
}

function isRiskSummaryData(data: Prisma.JsonValue): data is RiskSummaryData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  return typeof data.risk === 'string' && typeof data.completionConfidence === 'number';
}

const prisma = new PrismaClient();

export async function generateDigests(targetBoardId?: string): Promise<void> {
  const activeBoardIds = new Set<string>();

  if (targetBoardId) {
    activeBoardIds.add(targetBoardId);
  } else {
    // Collect active boards
    const users = await prisma.user.findMany();
    for (const user of users) {
      const userBoards = await prisma.board.findMany({
        where: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } }
          ]
        }
      });
      for (const b of userBoards) {
        activeBoardIds.add(b.id);
      }
    }
  }

  for (const boardId of activeBoardIds) {
    try {
      await generateDigestForBoard(boardId);
    } catch (err) {
      console.error(`[Digest] Error generating digest for board ${boardId}:`, err);
    }
  }
}

async function generateDigestForBoard(boardId: string): Promise<void> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        include: {
          cards: true
        }
      },
      aiInsights: {
        orderBy: { createdAt: 'desc' },
        take: 100 // fetch recent to find bottleneck/sprint risk
      }
    }
  });

  if (!board) return;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const completionNames = ['done', 'completed', 'complete', 'finished', 'closed', 'resolved'];

  let cardsCreated = 0;
  let cardsCompleted = 0;
  let previousCardsCompleted = 0;
  let currentWIP = 0;

  for (const col of board.columns) {
    const isCompleted = completionNames.includes(col.name.trim().toLowerCase());
    
    for (const card of col.cards) {
      const createdAt = new Date(card.createdAt);
      const updatedAt = new Date(card.updatedAt);

      if (createdAt >= oneWeekAgo) {
        cardsCreated++;
      }

      if (isCompleted) {
        if (updatedAt >= oneWeekAgo) {
          cardsCompleted++;
        } else if (updatedAt >= twoWeeksAgo && updatedAt < oneWeekAgo) {
          previousCardsCompleted++;
        }
      } else {
        currentWIP++;
      }
    }
  }

  // Velocity (completed per day in the last 7 days)
  const currentVelocity = cardsCompleted / 7;
  const previousVelocity = previousCardsCompleted / 7;

  let velocityTrend = 'Stable';
  if (currentVelocity > previousVelocity * 1.1) {
    velocityTrend = 'Increasing';
  } else if (currentVelocity < previousVelocity * 0.9) {
    velocityTrend = 'Decreasing';
  }

  // Bottleneck & Risk
  let topBottleneck: Prisma.InputJsonValue | undefined = undefined;
  let riskSummary: Prisma.InputJsonValue | undefined = undefined;
  const recommendations: string[] = [];

  const bottleneckInsight = board.aiInsights.find(i => i.type === 'BOTTLENECK');
  if (bottleneckInsight && bottleneckInsight.data) {
    topBottleneck = bottleneckInsight.data;
    if (isBottleneckData(bottleneckInsight.data)) {
      recommendations.push(`Reduce WIP in ${bottleneckInsight.data.column}.`);
      if (bottleneckInsight.data.unassignedCount > 0) {
         recommendations.push(`Assign ${bottleneckInsight.data.unassignedCount} unassigned tasks in ${bottleneckInsight.data.column}.`);
      }
    }
  }

  const riskInsight = board.aiInsights.find(i => i.type === 'SPRINT_RISK');
  if (riskInsight && riskInsight.data) {
    riskSummary = riskInsight.data;
    if (isRiskSummaryData(riskInsight.data)) {
      if (riskInsight.data.risk === 'HIGH') {
        recommendations.push(`Review scope: Current velocity indicates only ${riskInsight.data.completionConfidence}% of remaining work can be completed.`);
      }
    }
  }

  if (currentWIP > 10) {
    recommendations.push(`Focus on finishing existing ${currentWIP} tasks before starting new ones.`);
  }

  if (velocityTrend === 'Decreasing') {
    recommendations.push(`Investigate why velocity dropped compared to last week.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Keep up the good work! Velocity and WIP are stable.');
  }

  const rawMetrics = {
    previousCardsCompleted,
    currentVelocity,
    previousVelocity
  };

  const digest = await prisma.weeklyDigest.create({
    data: {
      boardId: board.id,
      periodStart: oneWeekAgo,
      periodEnd: now,
      cardsCreated,
      cardsCompleted,
      currentVelocity,
      velocityTrend,
      currentWIP,
      topBottleneck,
      riskSummary,
      recommendations,
      rawMetrics
    }
  });

  const io = getIO();
  if (io) {
    io.to(board.id).emit('ai:digest', { boardId: board.id, digest: JSON.stringify(digest) });
  }
}
