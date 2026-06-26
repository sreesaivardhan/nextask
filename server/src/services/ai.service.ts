import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';
import { boardService } from './board.service';

// Force IDE cache reload
const prisma = new PrismaClient();

export async function analyzeBoards(): Promise<void> {
  console.log('[AI] Scheduler started');
  console.log('[AI] Starting analysis');
  const start = Date.now();

  // Obtain the active board list using the exact same backend path as the dashboard.
  // The dashboard shows boards per user via GET /api/boards (which calls boardService.getBoards).
  const users = await prisma.user.findMany();
  const activeBoardIds = new Set<string>();

  for (const user of users) {
    const userBoards = await boardService.getBoards(user.id);
    for (const b of userBoards) {
      activeBoardIds.add(b.id);
    }
  }

  // Fetch the deep relations for the EXACT set of active boards
  const boards = await prisma.board.findMany({
    where: {
      id: { in: Array.from(activeBoardIds) }
    },
    include: {
      columns: {
        include: {
          cards: true,
        },
        orderBy: {
          position: 'asc',
        },
      },
    },
  });

  for (const board of boards) {
    console.log(`[AI] Board: ${board.name}`);
    console.log(`[AI] ID: ${board.id}`);
    
    const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
    console.log(`[AI] Cards: ${totalCards}`);
    console.log(`[AI] Columns: ${board.columns.length}`);
    
    // ==========================================
    // 1. BOTTLENECK DETECTION
    // ==========================================
    console.log(`[AI] Analysis: Checking for bottlenecks`);

    if (board.columns.length < 2) {
      console.log('[AI] Result: Skipped');
      console.log('[AI] Reason: Board has fewer than 2 columns');
    } else if (totalCards < 5) {
      console.log('[AI] Result: Skipped');
      console.log('[AI] Reason: Board has too few cards (threshold: 5)');
    } else {
      let maxColumn = null;
      let maxCount = 0;

      // Treat a column as terminal ONLY if its name matches common completion names.
      const completionNames = ['done', 'completed', 'complete', 'finished', 'closed', 'resolved'];
      let activeColumns = board.columns;
      
      const lastColumn = board.columns[board.columns.length - 1];
      if (completionNames.includes(lastColumn.name.trim().toLowerCase())) {
        activeColumns = board.columns.slice(0, -1);
      }

      for (const col of activeColumns) {
        if (col.cards.length > maxCount) {
          maxCount = col.cards.length;
          maxColumn = col;
        }
      }

      if (maxColumn && maxCount > 3 && maxCount / totalCards > 0.4) {
        const score = Number((maxCount / totalCards).toFixed(2));
        const type = 'BOTTLENECK';
        const title = `Bottleneck detected in ${maxColumn.name}`;
        const summary = `Cards are accumulating faster than they leave.`;
        const data = {
          column: maxColumn.name,
          score,
          reason: 'Cards are accumulating faster than they leave.',
          cardCount: maxCount,
        };

        const latestBottleneck = await prisma.aIInsight.findFirst({
          where: { boardId: board.id, type: 'BOTTLENECK' },
          orderBy: { createdAt: 'desc' }
        });

        const latestData = latestBottleneck ? (latestBottleneck.data as Record<string, unknown>) : null;
        
        const isIdentical = Boolean(
          latestBottleneck &&
          latestBottleneck.title === title &&
          latestBottleneck.summary === summary &&
          latestData &&
          latestData.column === data.column &&
          latestData.score === data.score &&
          latestData.cardCount === data.cardCount
        );

        if (isIdentical) {
          console.log('[AI] Result: Skipped (Identical analysis)');
        } else {
          const insight = await prisma.aIInsight.create({
            data: { boardId: board.id, type, title, summary, data },
          });

          console.log('[AI] Result: Inserted');
          const io = getIO();
          if (io) io.to(board.id).emit('ai:insight', insight);
        }
      } else {
        console.log('[AI] Result: Skipped');
        console.log('[AI] Reason: No bottleneck detected based on thresholds');
      }
    }

    // ==========================================
    // 2. SPRINT RISK ASSESSMENT
    // ==========================================
    console.log(`[AI] Analysis: Sprint Risk Assessment`);
    
    if (!board.sprintEndDate) {
      console.log('[AI] Sprint Risk: Skipped');
      console.log('[AI] Reason: No sprintEndDate');
    } else {
      const completionNames = ['done', 'completed', 'finished', 'resolved', 'closed'];
      let completedCards = 0;
      let remainingCards = 0;
      
      for (const col of board.columns) {
        if (completionNames.includes(col.name.trim().toLowerCase())) {
          completedCards += col.cards.length;
        } else {
          remainingCards += col.cards.length;
        }
      }

      const sprintLengthDays = 14;
      const sprintEnd = new Date(board.sprintEndDate);
      const sprintStart = new Date(sprintEnd.getTime() - sprintLengthDays * 24 * 60 * 60 * 1000);
      const today = new Date();
      
      const elapsedDaysRaw = (today.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = Math.max(1, elapsedDaysRaw);
      
      const remainingDaysRaw = (sprintEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      const remainingDays = Math.max(0.1, remainingDaysRaw);
      
      const velocity = completedCards / elapsedDays;
      const requiredVelocity = remainingCards / remainingDays;
      
      let risk = 'HIGH';
      let summary = 'Current velocity is unlikely to finish before the deadline.';
      
      if (requiredVelocity <= velocity) {
        risk = 'LOW';
        summary = 'Current velocity is sufficient to complete the sprint.';
      } else if (requiredVelocity <= velocity * 1.5) {
        risk = 'MEDIUM';
        summary = 'Sprint is slightly behind schedule.';
      }
      
      const type = 'SPRINT_RISK';
      const title = 'Sprint Risk Assessment';
      const data = {
        velocity: Number(velocity.toFixed(2)),
        requiredVelocity: Number(requiredVelocity.toFixed(2)),
        remainingCards,
        completedCards,
        remainingDays: Number(remainingDays.toFixed(1)),
        risk
      };
      
      console.log(`[AI] Sprint End: ${sprintEnd.toISOString()}`);
      console.log(`[AI] Completed Cards: ${completedCards}`);
      console.log(`[AI] Remaining Cards: ${remainingCards}`);
      console.log(`[AI] Velocity: ${data.velocity}`);
      console.log(`[AI] Required Velocity: ${data.requiredVelocity}`);
      console.log(`[AI] Risk: ${risk}`);

      const latestSprintRisk = await prisma.aIInsight.findFirst({
        where: { boardId: board.id, type: 'SPRINT_RISK' },
        orderBy: { createdAt: 'desc' }
      });
      
      const latestData = latestSprintRisk ? (latestSprintRisk.data as Record<string, unknown>) : null;
      
      const isIdentical = Boolean(
        latestSprintRisk &&
        latestSprintRisk.summary === summary &&
        latestData &&
        latestData.risk === data.risk &&
        latestData.velocity === data.velocity &&
        latestData.requiredVelocity === data.requiredVelocity &&
        latestData.remainingCards === data.remainingCards &&
        latestData.completedCards === data.completedCards &&
        latestData.remainingDays === data.remainingDays
      );
      
      if (isIdentical) {
        console.log('[AI] Sprint Risk Result: Skipped');
        console.log('[AI] Reason: Identical analysis');
      } else {
        const insight = await prisma.aIInsight.create({
          data: { boardId: board.id, type, title, summary, data },
        });
        console.log('[AI] Sprint Risk Result: Inserted');
        
        const io = getIO();
        if (io) io.to(board.id).emit('ai:insight', insight);
      }
    }
  }

  const duration = Date.now() - start;
  console.log(`[AI] Duration: ${duration}ms`);
  console.log('[AI] Finished');
}
