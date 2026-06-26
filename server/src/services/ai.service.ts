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
      aiInsights: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  for (const board of boards) {
    console.log(`[AI] Board: ${board.name}`);
    console.log(`[AI] ID: ${board.id}`);
    
    const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
    console.log(`[AI] Cards: ${totalCards}`);
    console.log(`[AI] Columns: ${board.columns.length}`);
    console.log(`[AI] Analysis: Checking for bottlenecks`);

    if (board.columns.length < 2) {
      console.log('[AI] Result: Skipped');
      console.log('[AI] Reason: Board has fewer than 2 columns');
      continue;
    }

    if (totalCards < 5) {
      console.log('[AI] Result: Skipped');
      console.log('[AI] Reason: Board has too few cards (threshold: 5)');
      continue;
    }

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

    // Thresholds:
    // 1. Column must hold > 40% of all cards on the board
    // 2. Column must hold > 3 cards
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

      const latestInsight = board.aiInsights[0];

      // Duplicate prevention logic
      const latestData = latestInsight ? (latestInsight.data as Record<string, unknown>) : null;
      
      const isIdentical = Boolean(
        latestInsight &&
        latestInsight.type === type &&
        latestInsight.title === title &&
        latestInsight.summary === summary &&
        latestData &&
        latestData.column === data.column &&
        latestData.score === data.score &&
        latestData.cardCount === data.cardCount
      );

      if (isIdentical) {
        console.log('[AI] Result: Skipped');
        console.log('[AI] Reason: Identical analysis');
      } else {
        const insight = await prisma.aIInsight.create({
          data: {
            boardId: board.id,
            type,
            title,
            summary,
            data,
          },
        });

        console.log('[AI] Result: Inserted');

        // Broadcast to board room ONLY on actual insert
        const io = getIO();
        if (io) {
          const room = board.id;
          const clientsInRoom = io.sockets.adapter.rooms.get(room)?.size || 0;
          
          console.log('[AI Socket]');
          console.log(`Board ID: ${board.id}`);
          console.log(`Room: ${room}`);
          console.log(`Insight ID: ${insight.id}`);
          console.log(`Clients in room: ${clientsInRoom}`);
          console.log('Emitting ai:insight');
          
          io.to(room).emit('ai:insight', insight);
        }
      }
    } else {
      console.log('[AI] Result: Skipped');
      console.log('[AI] Reason: No bottleneck detected based on thresholds');
    }
  }

  const duration = Date.now() - start;
  console.log(`[AI] Duration: ${duration}ms`);
  console.log('[AI] Finished');
}
