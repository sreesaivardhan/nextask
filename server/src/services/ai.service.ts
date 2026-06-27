import { PrismaClient } from '@prisma/client';
import { getIO } from '../socket';
import { boardService } from './board.service';

// Force IDE cache reload
const prisma = new PrismaClient();

export async function analyzeBoards(targetBoardId?: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') console.log(targetBoardId ? `[AI] Targeted analysis for board ${targetBoardId}` : '[AI] Scheduler started');
  if (process.env.NODE_ENV === 'development') console.log('[AI] Starting analysis');
  const start = Date.now();

  const activeBoardIds = new Set<string>();

  if (targetBoardId) {
    activeBoardIds.add(targetBoardId);
  } else {
    // Obtain the active board list using the exact same backend path as the dashboard.
    // The dashboard shows boards per user via GET /api/boards (which calls boardService.getBoards).
    const users = await prisma.user.findMany();
    for (const user of users) {
      const userBoards = await boardService.getBoards(user.id);
      for (const b of userBoards) {
        activeBoardIds.add(b.id);
      }
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
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Board: ${board.name}`);
    if (process.env.NODE_ENV === 'development') console.log(`[AI] ID: ${board.id}`);
    
    const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Cards: ${totalCards}`);
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Columns: ${board.columns.length}`);
    
    // ==========================================
    // 1. BOTTLENECK DETECTION
    // ==========================================
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Analysis: Checking for bottlenecks`);

    if (board.columns.length < 2) {
      if (process.env.NODE_ENV === 'development') console.log('[AI] Result: Skipped');
      if (process.env.NODE_ENV === 'development') console.log('[AI] Reason: Board has fewer than 2 columns');
    } else if (totalCards < 5) {
      if (process.env.NODE_ENV === 'development') console.log('[AI] Result: Skipped');
      if (process.env.NODE_ENV === 'development') console.log('[AI] Reason: Board has too few cards (threshold: 5)');
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
        const severityPercent = Math.min(100, Math.max(0, Math.round(score * 100)));
        const type = 'BOTTLENECK';
        const title = `Bottleneck detected in ${maxColumn.name}`;
        
        let unassignedCount = 0;
        let totalComplexity = 0;
        let complexityCount = 0;
        const assigneeCounts = new Map<string, number>();
        const categoryWords = new Map<string, number>();
        
        for (const card of maxColumn.cards) {
            if (!card.assigneeId) unassignedCount++;
            else assigneeCounts.set(card.assigneeId, (assigneeCounts.get(card.assigneeId) || 0) + 1);
            
            if (card.complexity) {
                totalComplexity += card.complexity;
                complexityCount++;
            }
            
            const words = (card.title + ' ' + (card.description||'')).toLowerCase().split(/\W+/).filter(w => w.length > 4);
            for (const w of words) {
                if (['auth', 'backend', 'frontend', 'database', 'api', 'ui', 'css', 'design', 'testing', 'bug', 'server', 'client', 'oauth'].includes(w)) {
                    categoryWords.set(w, (categoryWords.get(w)||0) + 1);
                }
            }
        }

        const avgComplexity = complexityCount > 0 ? (totalComplexity / complexityCount).toFixed(1) : 'unknown';
        
        let overloadedAssignee = null;
        for (const [assigneeId, count] of assigneeCounts.entries()) {
            if (count > maxCount * 0.4 && count > 1) overloadedAssignee = assigneeId;
        }

        let topCategory = null;
        let topCatCount = 0;
        for (const [cat, count] of categoryWords.entries()) {
             if (count > topCatCount) {
                 topCatCount = count;
                 topCategory = cat;
             }
        }

        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        let arrivedLast7Days = 0;
        let completedLast7Days = 0;
        for (const col of board.columns) {
            for (const card of col.cards) {
                if (new Date(card.createdAt) > sevenDaysAgo) arrivedLast7Days++;
                if (completionNames.includes(col.name.trim().toLowerCase())) {
                    if (new Date(card.updatedAt) > sevenDaysAgo) completedLast7Days++;
                }
            }
        }
        const arrivalRate = (arrivedLast7Days / 7).toFixed(1);
        const completionRate = (completedLast7Days / 7).toFixed(1);

        const causes: string[] = [];
        if (topCategory && topCatCount >= 2) {
             causes.push(`Many tasks are related to high-effort '${topCategory}' work.`);
        }
        if (unassignedCount > 0) {
            causes.push(`${unassignedCount} task(s) remain unassigned.`);
        }
        if (overloadedAssignee) {
            causes.push(`A single team member owns a large portion of the tasks in this column.`);
        }
        if (complexityCount > 0 && (totalComplexity / complexityCount) >= 5) {
            causes.push(`Average estimated complexity is high (${avgComplexity} SP).`);
        }
        if (arrivedLast7Days > completedLast7Days * 2) {
            causes.push(`Tasks are arriving much faster (${arrivalRate}/day) than they are being completed (${completionRate}/day).`);
        }
        
        const likelyCauseText = causes.length > 0 
           ? causes.join(' ') 
           : 'Tasks are accumulating without clear assignment or complexity issues. Check if there are external blockers.';

        const summary = `Column: ${maxColumn.name}\nCards: ${maxCount}\nArrival Rate: ${arrivalRate}/day\nCompletion Rate: ${completionRate}/day\n\nLikely Cause:\n${likelyCauseText}\n\nRecommendation:\nRedistribute work or reduce WIP before adding more tasks.`;

        const data = {
          column: maxColumn.name,
          score,
          severityPercent,
          reason: summary,
          cardCount: maxCount,
          unassignedCount,
          avgComplexity,
          likelyCause: likelyCauseText,
          arrivalRate,
          completionRate
        };

        const latestBottleneck = await prisma.aIInsight.findFirst({
          where: { boardId: board.id, type: 'BOTTLENECK' },
          orderBy: { createdAt: 'desc' }
        });

        const latestData = latestBottleneck ? (latestBottleneck.data as Record<string, unknown>) : null;
        
        const isIdentical = Boolean(
          latestBottleneck &&
          latestBottleneck.summary === summary &&
          latestData &&
          latestData.column === data.column &&
          latestData.score === data.score &&
          latestData.cardCount === data.cardCount
        );

        if (isIdentical) {
          if (process.env.NODE_ENV === 'development') console.log('[AI] Result: Skipped (Identical analysis)');
        } else {
          const insight = await prisma.aIInsight.create({
            data: { boardId: board.id, type, title, summary, data },
          });

          if (process.env.NODE_ENV === 'development') console.log('[AI] Result: Inserted');
          const io = getIO();
          if (io) io.to(board.id).emit('ai:insight', insight);
        }
      } else {
        if (process.env.NODE_ENV === 'development') console.log('[AI] Result: Skipped');
        if (process.env.NODE_ENV === 'development') console.log('[AI] Reason: No bottleneck detected based on thresholds');
      }
    }

    // ==========================================
    // 2. SPRINT RISK ASSESSMENT
    // ==========================================
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Analysis: Sprint Risk Assessment`);
    
    if (!board.sprintEndDate) {
      if (process.env.NODE_ENV === 'development') console.log('[AI] Sprint Risk: Skipped');
      if (process.env.NODE_ENV === 'development') console.log('[AI] Reason: No sprintEndDate');
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
      const completionConfidence = Math.max(0, Math.min(100, Math.round((velocity / requiredVelocity) * 100)));
      
      const data = {
        velocity: Number(velocity.toFixed(2)),
        requiredVelocity: Number(requiredVelocity.toFixed(2)),
        completionConfidence,
        remainingCards,
        completedCards,
        remainingDays: Number(remainingDays.toFixed(1)),
        risk
      };
      
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Sprint End: ${sprintEnd.toISOString()}`);
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Completed Cards: ${completedCards}`);
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Remaining Cards: ${remainingCards}`);
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Velocity: ${data.velocity}`);
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Required Velocity: ${data.requiredVelocity}`);
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Risk: ${risk}`);

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
        if (process.env.NODE_ENV === 'development') console.log('[AI] Sprint Risk Result: Skipped');
        if (process.env.NODE_ENV === 'development') console.log('[AI] Reason: Identical analysis');
      } else {
        const insight = await prisma.aIInsight.create({
          data: { boardId: board.id, type, title, summary, data },
        });
        if (process.env.NODE_ENV === 'development') console.log('[AI] Sprint Risk Result: Inserted');
        
        const io = getIO();
        if (io) io.to(board.id).emit('ai:insight', insight);
      }
    }

    // ==========================================
    // 3. TASK DEADLINE PREDICTION
    // ==========================================
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Analysis: Task Deadline Prediction`);
    
    let statsEvaluated = 0;
    let statsInserted = 0;
    let statsSkippedLowRisk = 0;
    let statsSkippedDuplicate = 0;
    let statsSkippedDone = 0;
    let statsSkippedNoSprint = 0;

    if (!board.sprintEndDate) {
      if (process.env.NODE_ENV === 'development') console.log('[AI] Task Deadline: Skipped (no sprintEndDate)');
      statsSkippedNoSprint += totalCards;
    } else if (totalCards === 0) {
      if (process.env.NODE_ENV === 'development') console.log('[AI] Task Deadline: Skipped (no cards)');
    } else {
      // Clean up insights for cards that have been deleted
      const existingDeadlineInsights = await prisma.aIInsight.findMany({
        where: { boardId: board.id, type: 'TASK_DEADLINE' }
      });
      const activeCardIds = new Set<string>();
      for (const col of board.columns) {
        for (const card of col.cards) {
          activeCardIds.add(card.id);
        }
      }
      for (const insight of existingDeadlineInsights) {
        const data = insight.data as Record<string, unknown>;
        const taskId = data?.taskId as string;
        if (taskId && !activeCardIds.has(taskId)) {
          if (process.env.NODE_ENV === 'development') console.log(`[AI] Cleaning up obsolete insight for deleted card: ${taskId}`);
          await prisma.aIInsight.delete({ where: { id: insight.id } });
          const io = getIO();
          if (io) io.to(board.id).emit('ai:insight:removed', { insightId: insight.id, boardId: board.id });
        }
      }

      const completionNames = ['done', 'completed', 'finished', 'resolved', 'closed'];
      const sprintEnd = new Date(board.sprintEndDate);
      const today = new Date();
      const remainingDaysRaw = (sprintEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      const remainingDays = Math.max(0, remainingDaysRaw);
      
      const activeCardsByAssignee = new Map<string, number>();
      for (const col of board.columns) {
        if (!completionNames.includes(col.name.trim().toLowerCase())) {
          for (const card of col.cards) {
            if (card.assigneeId) {
              activeCardsByAssignee.set(card.assigneeId, (activeCardsByAssignee.get(card.assigneeId) || 0) + 1);
            }
          }
        }
      }

      const latestSprintRisk = await prisma.aIInsight.findFirst({
        where: { boardId: board.id, type: 'SPRINT_RISK' },
        orderBy: { createdAt: 'desc' }
      });
      const sprintRiskData = latestSprintRisk ? (latestSprintRisk.data as Record<string, unknown>) : null;
      const sprintRiskDisplay = (sprintRiskData?.risk as string) || 'UNKNOWN';

      for (const col of board.columns) {
        const isCompletionCol = completionNames.includes(col.name.trim().toLowerCase());

        for (const card of col.cards) {
          statsEvaluated++;
          
          let score = 0;
          const reasons: string[] = [];
          
          const ageDays = (today.getTime() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          const idleDays = (today.getTime() - new Date(card.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
          
          if (isCompletionCol) {
            score -= 2;
            reasons.push(`Task is already completed (-2)`);
          } else {
            // 1. Idle Time
            if (idleDays > 10) {
              score += 6;
              reasons.push(`Idle >10 days (+6)`);
            } else if (idleDays > 5) {
              score += 4;
              reasons.push(`Idle for ${Math.floor(idleDays)} days (+4)`);
            } else if (idleDays > 2) {
              score += 2;
              reasons.push(`Idle for ${Math.floor(idleDays)} days (+2)`);
            }

            // 2. Column Position
            const colIndex = board.columns.findIndex(c => c.id === col.id);
            if (colIndex === 0) {
              score += 3;
              reasons.push(`Todo column (+3)`);
            } else if (colIndex === 1) {
              score += 1;
              reasons.push(`Doing column (+1)`);
            }

            // 3. Sprint Risk Weight
            if (sprintRiskDisplay === 'HIGH') {
              score += 4;
              reasons.push(`Sprint HIGH (+4)`);
            } else if (sprintRiskDisplay === 'MEDIUM') {
              score += 2;
              reasons.push(`Sprint MEDIUM (+2)`);
            }

            // 4. Remaining Sprint Days
            if (remainingDays <= 1) {
              score += 6;
              reasons.push(`Remaining ${Math.max(0, Math.floor(remainingDays))} days (+6)`);
            } else if (remainingDays <= 3) {
              score += 4;
              reasons.push(`Remaining ${Math.floor(remainingDays)} days (+4)`);
            } else if (remainingDays <= 7) {
              score += 2;
              reasons.push(`Remaining ${Math.floor(remainingDays)} days (+2)`);
            }

            // 5. Assignee Workload
            if (card.assigneeId) {
              const assigneeTasks = activeCardsByAssignee.get(card.assigneeId) || 0;
              if (assigneeTasks >= 8) {
                score += 5;
                reasons.push(`Assignee overloaded (+5)`);
              } else if (assigneeTasks >= 5) {
                score += 3;
                reasons.push(`Assignee has ${assigneeTasks} active tasks (+3)`);
              } else if (assigneeTasks >= 3) {
                score += 1;
                reasons.push(`Assignee has ${assigneeTasks} active tasks (+1)`);
              }
            }

            // 6 & 7. Recently Created vs Recently Updated (Mutually Exclusive)
            const createdAtMs = new Date(card.createdAt).getTime();
            const updatedAtMs = new Date(card.updatedAt).getTime();
            const createdRecently = ageDays < 1;
            const updatedRecently = (updatedAtMs > createdAtMs) && (idleDays < 1);

            if (createdRecently) {
              score -= 1;
              reasons.push(`Recently created (-1)`);
            } else if (updatedRecently) {
              score -= 1;
              reasons.push(`Recently worked on (-1)`);
            }
          }

          score = Math.max(0, score);

          let risk = 'LOW';
          if (score >= 11) risk = 'HIGH';
          else if (score >= 6) risk = 'MEDIUM';

          const assigneeName = card.assigneeId ? `User ${card.assigneeId.slice(-4)}` : 'None';

          let decision = '';
          let reasonText = '';
          let duplicateFound = false;
          let existingInsightId = 'NONE';
          let newlyInsertedId = '';

          const latestTaskInsight = await prisma.aIInsight.findFirst({
            where: { 
              boardId: board.id, 
              type: 'TASK_DEADLINE',
              data: {
                path: ['taskId'],
                equals: card.id
              }
            },
            orderBy: { createdAt: 'desc' }
          });

          const latestData = latestTaskInsight ? (latestTaskInsight.data as Record<string, unknown>) : null;
          existingInsightId = latestTaskInsight ? latestTaskInsight.id : 'NONE';

          if (risk === 'LOW') {
            if (isCompletionCol) {
              decision = 'SKIPPED_DONE_COLUMN';
              reasonText = 'Task is already in a completion column.';
              statsSkippedDone++;
            } else {
              decision = 'SKIPPED_LOW_RISK';
              reasonText = `Score ${score} is below insertion threshold.`;
              statsSkippedLowRisk++;
            }

            if (latestTaskInsight) {
              await prisma.aIInsight.deleteMany({
                where: {
                  boardId: board.id,
                  type: 'TASK_DEADLINE',
                  data: {
                    path: ['taskId'],
                    equals: card.id
                  }
                }
              });
              reasonText += ` Removed obsolete insight ${latestTaskInsight.id}.`;
              const io = getIO();
              if (io) io.to(board.id).emit('ai:insight:removed', { insightId: latestTaskInsight.id, boardId: board.id });
            }
          } else {
            const type = 'TASK_DEADLINE';
            const title = 'Task likely to miss sprint';
            const summary = `Task "${card.title}" has a ${risk} probability of missing the sprint deadline.`;
            
            const confidence = Math.min(100, Math.max(0, Math.round((score / 15) * 100)));
            
            const data = {
              taskId: card.id,
              taskTitle: card.title,
              risk,
              score,
              confidence,
              column: col.name,
              assignee: card.assigneeId ? `User ${card.assigneeId.slice(-4)}` : 'Unassigned',
              daysRemaining: Number(remainingDays.toFixed(1)),
              reasons
            };

            duplicateFound = Boolean(
              latestTaskInsight &&
              latestData &&
              latestData.score === data.score &&
              latestData.risk === data.risk &&
              latestData.column === data.column &&
              latestData.daysRemaining === data.daysRemaining &&
              JSON.stringify(latestData.reasons) === JSON.stringify(data.reasons)
            );

            if (duplicateFound) {
              decision = 'SKIPPED_DUPLICATE';
              reasonText = 'Existing TASK_DEADLINE insight has identical score, risk and reasons.';
              statsSkippedDuplicate++;
            } else {
              const insight = await prisma.aIInsight.create({
                data: { boardId: board.id, type, title, summary, data },
              });
              decision = 'INSERTED';
              newlyInsertedId = insight.id;
              statsInserted++;
              
              const io = getIO();
              if (io) io.to(board.id).emit('ai:insight', insight);
            }
          }

          if (process.env.NODE_ENV === 'development') console.log('--------------------------------------------------');
          if (process.env.NODE_ENV === 'development') console.log('[AI] Task Deadline Evaluation\n');
          if (process.env.NODE_ENV === 'development') console.log(`Board:\n${board.name}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Board ID:\n${board.id}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Task ID:\n${card.id}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Task Title:\n${card.title}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Current Column:\n${col.name}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Column ID:\n${col.id}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Created At:\n${new Date(card.createdAt).toISOString()}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Updated At:\n${new Date(card.updatedAt).toISOString()}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Assignee:\n${assigneeName}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Days Since Update:\n${idleDays.toFixed(1)}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Sprint Remaining Days:\n${remainingDays.toFixed(1)}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Sprint Risk:\n${sprintRiskDisplay}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Score:\n${score}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Risk:\n${risk}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Reasons:\n[\n  ${reasons.join(',\n  ')}\n]\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Duplicate Found:\n${duplicateFound}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Existing Insight ID:\n${existingInsightId}\n`);
          if (process.env.NODE_ENV === 'development') console.log(`Decision:\n${decision}\n`);
          if (decision === 'INSERTED') {
            if (process.env.NODE_ENV === 'development') console.log(`Insight ID:\n${newlyInsertedId}\n`);
          } else {
            if (process.env.NODE_ENV === 'development') console.log(`Reason:\n${reasonText}\n`);
          }
          if (process.env.NODE_ENV === 'development') console.log('--------------------------------------------------');
        }
      }
    }

    if (process.env.NODE_ENV === 'development') console.log('\n========== TASK DEADLINE SUMMARY ==========');
    if (process.env.NODE_ENV === 'development') console.log(`Board:\n${board.name}\n`);
    if (process.env.NODE_ENV === 'development') console.log(`Cards Evaluated:\n${statsEvaluated}\n`);
    if (process.env.NODE_ENV === 'development') console.log(`Inserted:\n${statsInserted}\n`);
    if (process.env.NODE_ENV === 'development') console.log(`Skipped Low Risk:\n${statsSkippedLowRisk}\n`);
    if (process.env.NODE_ENV === 'development') console.log(`Skipped Duplicate:\n${statsSkippedDuplicate}\n`);
    if (process.env.NODE_ENV === 'development') console.log(`Skipped Done:\n${statsSkippedDone}\n`);
    if (process.env.NODE_ENV === 'development') console.log(`Skipped No Sprint:\n${statsSkippedNoSprint}\n`);
    if (process.env.NODE_ENV === 'development') console.log('==========================================\n');
  }

  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') console.log(`[AI] Duration: ${duration}ms`);
  if (process.env.NODE_ENV === 'development') console.log('[AI] Finished');
}

/**
 * Event-driven AI complexity inference.
 * Infers task complexity based on heuristics and historical similar cards.
 */
export async function inferCardComplexity(cardId: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') console.log(`[AI] Starting complexity inference for card: ${cardId}`);
  
  try {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        board: {
          include: {
            columns: true
          }
        },
        labels: {
          include: { label: true }
        }
      }
    });

    if (!card || !card.board) {
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Card not found or has no board`);
      return;
    }

    const title = card.title || '';
    const description = card.description || '';
    const fullText = `${title} ${description}`.toLowerCase();

    // 1. Base Description Richness Score
    let score = 0;
    const reasons: string[] = [];

    const descLength = description.length;
    if (descLength > 1000) {
      score += 4;
      reasons.push('Detailed description (>1000 chars) indicates complexity');
    } else if (descLength > 300) {
      score += 2;
      reasons.push('Moderate description depth indicates average complexity');
    }

    const hasAcceptanceCriteria = /acceptance criteria|checklist|- \[ \]|1\.|todo/i.test(description);
    if (hasAcceptanceCriteria) {
      score += 2;
      reasons.push('Structured acceptance criteria detected');
    }

    // 2. Technical Keyword Heuristics
    const keywords = [
      { words: ['auth', 'oauth', 'jwt', 'login', 'passport', 'session'], points: 3, label: 'Authentication work detected' },
      { words: ['payment', 'stripe', 'checkout', 'billing'], points: 4, label: 'Payment gateway integration detected' },
      { words: ['database', 'schema', 'migration', 'prisma', 'sql', 'postgres'], points: 3, label: 'Database schema changes required' },
      { words: ['socket', 'realtime', 'real-time', 'websocket', 'broadcast'], points: 3, label: 'Real-time / Socket communication detected' },
      { words: ['api', 'rest', 'endpoint', 'fetch', 'axios', 'graphql'], points: 2, label: 'API endpoint implementation required' },
      { words: ['ai', 'machine learning', 'inference', 'heuristic', 'prompt'], points: 4, label: 'AI/ML related work detected' },
      { words: ['docker', 'deploy', 'pipeline', 'ci/cd', 'infrastructure', 'railway'], points: 3, label: 'Deployment or Infrastructure work detected' },
      { words: ['redis', 'queue', 'bull', 'worker', 'background'], points: 3, label: 'Background processing / Queue detected' },
      { words: ['test', 'jest', 'cypress', 'e2e'], points: 1, label: 'Testing requirements specified' }
    ];

    let signalsMatched = 0;
    for (const kw of keywords) {
      if (kw.words.some(w => fullText.includes(w))) {
        score += kw.points;
        reasons.push(kw.label);
        signalsMatched++;
      }
    }

    // 3. Historical Similarity Lookup
    // Find "Done" columns
    const completionNames = ['done', 'completed', 'finished', 'resolved', 'closed'];
    const doneColumnIds = card.board.columns
      .filter(c => completionNames.includes(c.name.trim().toLowerCase()))
      .map(c => c.id);

    let historicalMatchPoints = 0;
    let historicalCount = 0;
    let avgHistorical = 0;
    let bestSimilarity = 0;
    
    const matches: { card: { id: string, title: string, description: string | null, complexity: number | null }, similarity: number }[] = [];

    if (doneColumnIds.length > 0) {
      const completedCards = await prisma.card.findMany({
        where: {
          boardId: card.boardId,
          columnId: { in: doneColumnIds },
          id: { not: card.id },
          complexity: { not: null },
          complexityStatus: { in: ['ACCEPTED', 'OVERRIDDEN'] }
        }
      });

      const extractWords = (text: string): Set<string> => {
        return new Set(
          text.toLowerCase().split(/\W+/)
            .filter(w => w.length > 4 && !['about', 'there', 'which', 'their'].includes(w))
        );
      };

      const getSimilarity = (text1: string, text2: string): number => {
        if (!text1 && !text2) return 1.0;
        if (!text1 || !text2) return 0.0;
        const words1 = extractWords(text1);
        const words2 = extractWords(text2);
        if (words1.size === 0 && words2.size === 0) return 1.0;
        if (words1.size === 0 || words2.size === 0) return 0.0;
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
      };

      for (const compCard of completedCards) {
        if (!compCard.complexity) continue;
        
        const titleSim = getSimilarity(title, compCard.title || '');
        let descSim = 0;
        let weightTitle = 0.7;
        let weightDesc = 0.3;

        // If description is empty for both new and completed card, match solely on title
        if (!description && !compCard.description) {
           weightTitle = 1.0;
           weightDesc = 0.0;
        } else {
           descSim = getSimilarity(description, compCard.description || '');
        }

        const similarity = (titleSim * weightTitle) + (descSim * weightDesc);
        
        // If similarity is > 20%, consider it a match
        if (similarity > 0.20) {
          matches.push({ card: compCard, similarity });
        }
      }

      matches.sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        bestSimilarity = matches[0].similarity;
        for (const match of matches) {
           historicalMatchPoints += match.card.complexity!;
           historicalCount++;
        }
        avgHistorical = Math.round(historicalMatchPoints / historicalCount);
        
        if (bestSimilarity > 0.8) signalsMatched += 4;
        else if (bestSimilarity > 0.5) signalsMatched += 3;
        else signalsMatched += 2;
      }
    }

    // Map score to Fibonacci Story Points [1, 2, 3, 5, 8, 13]
    let baseSp = 1;
    if (score >= 18) baseSp = 13;
    else if (score >= 12) baseSp = 8;
    else if (score >= 7) baseSp = 5;
    else if (score >= 4) baseSp = 3;
    else if (score >= 2) baseSp = 2;

    let suggestedSp = baseSp;

    // Blend historical SP with base SP
    if (historicalCount > 0) {
       const blended = (baseSp + avgHistorical) / 2;
       const fib = [1, 2, 3, 5, 8, 13];
       suggestedSp = fib.reduce((prev, curr) => 
         Math.abs(curr - blended) < Math.abs(prev - blended) ? curr : prev
       );
       
       reasons.push('Historical Reference ✔ Similar completed task(s) found');
       matches.forEach(m => {
          reasons.push(`Task: ${m.card.title} (Similarity: ${Math.round(m.similarity * 100)}%) → ${m.card.complexity} SP`);
       });
       if (matches.length > 1) {
          reasons.push(`Average Historical Complexity: ${avgHistorical} SP`);
       }
       reasons.push(`Used as historical evidence for this estimate.`);
    }

    // Calculate Confidence
    let confidence = 45; // base confidence
    if (signalsMatched > 0) confidence += signalsMatched * 10;
    if (descLength > 500) confidence += 10;
    if (descLength < 50) confidence -= 10; // ambiguous

    if (historicalCount > 0) {
       const strongMatches = matches.filter(m => m.similarity > 0.6);
       if (strongMatches.length > 1) {
           confidence = 95;
       } else if (strongMatches.length === 1 || bestSimilarity > 0.5) {
           confidence = Math.max(confidence, 75);
       } else {
           confidence = Math.max(confidence, 60);
       }
    } else {
       if (signalsMatched === 0 && descLength < 100) confidence = 20;
    }
    
    confidence = Math.max(0, Math.min(95, confidence));

    if (reasons.length === 0) {
      reasons.push('Limited context provided. Assigned base complexity.');
    }

    // 4. Duplicate Prevention (Do not overwrite if nothing materially changed)
    const existingSp = card.suggestedSp;
    const existingConfidence = card.spConfidence;
    const existingReasons = JSON.stringify(card.spReasons || []);
    const newReasonsStr = JSON.stringify(reasons);

    if (
      existingSp === suggestedSp &&
      existingConfidence === confidence &&
      existingReasons === newReasonsStr
    ) {
      if (process.env.NODE_ENV === 'development') console.log(`[AI] Inference identical to existing prediction. Skipping update.`);
      return;
    }

    // Persist
    const updatedCard = await prisma.card.update({
      where: { id: cardId },
      data: {
        suggestedSp,
        spConfidence: confidence,
        spReasons: reasons,
        complexityStatus: 'PENDING',
        version: { increment: 1 }
      },
      include: {
        labels: { include: { label: true } },
        assignee: true,
        lastEditedBy: true,
      }
    });

    if (process.env.NODE_ENV === 'development') console.log(`[AI] Persisted complexity inference for ${cardId}: ${suggestedSp} SP (${confidence}%)`);

    // Emit Socket
    const io = getIO();
    if (io) {
      io.to(card.boardId).emit('card:updated', updatedCard);
    }
  } catch (error) {
    console.error(`[AI] Error inferring card complexity:`, error);
  }
}

/**
 * Invalidates historical state for a board and recalculates complexity for affected cards.
 * Triggered when a historical card is deleted, moved, or its complexity is accepted/overridden.
 */
export async function invalidateHistoricalState(boardId: string, triggerCardId?: string, reason?: string): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'development') console.log(`\n========================================`);
    if (process.env.NODE_ENV === 'development') console.log(`[AI] invalidate triggered by ${reason || 'unknown'}`);
    if (process.env.NODE_ENV === 'development') console.log(`Board: ${boardId}`);
    if (process.env.NODE_ENV === 'development') console.log(`Card: ${triggerCardId || 'none'}`);

    // Fetch done columns to count eligible historical cards for debugging
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: { columns: true }
    });
    const doneColumnIds = board?.columns
      .filter(c => c.name.toLowerCase().includes('done') || c.name.toLowerCase().includes('complete'))
      .map(c => c.id) || [];
      
    const eligibleCount = await prisma.card.count({
      where: {
        boardId,
        columnId: { in: doneColumnIds },
        ...(triggerCardId ? { id: { not: triggerCardId } } : {}),
        complexity: { not: null },
        complexityStatus: { in: ['ACCEPTED', 'OVERRIDDEN'] }
      }
    });
    if (process.env.NODE_ENV === 'development') console.log(`Eligible historical cards: ${eligibleCount}`);

    const pendingCards = await prisma.card.findMany({
      where: {
        boardId,
        complexityStatus: 'PENDING',
        ...(triggerCardId ? { id: { not: triggerCardId } } : {})
      }
    });

    if (process.env.NODE_ENV === 'development') console.log(`Pending cards recalculated: ${pendingCards.length}`);
    if (process.env.NODE_ENV === 'development') console.log(`========================================\n`);

    for (const card of pendingCards) {
      await inferCardComplexity(card.id).catch(console.error);
    }
  } catch (error) {
    console.error('[AI] Error in invalidateHistoricalState:', error);
  }
}

/**
 * Event-driven AI board insights invalidation.
 * Recalculates deadline prediction and sprint risk when a board state changes.
 */
export async function invalidateBoardInsights(boardId: string): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'development') console.log(`[AI] Invalidating and recalculating insights for board ${boardId}`);
    await analyzeBoards(boardId);
  } catch (err) {
    console.error(`[AI] Error invalidating board insights for ${boardId}:`, err);
  }
}
