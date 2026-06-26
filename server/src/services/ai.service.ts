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
        const severityPercent = Math.min(100, Math.max(0, Math.round(score * 100)));
        const type = 'BOTTLENECK';
        const title = `Bottleneck detected in ${maxColumn.name}`;
        const summary = `Cards are accumulating faster than they leave.`;
        const data = {
          column: maxColumn.name,
          score,
          severityPercent,
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

    // ==========================================
    // 3. TASK DEADLINE PREDICTION
    // ==========================================
    console.log(`[AI] Analysis: Task Deadline Prediction`);
    
    let statsEvaluated = 0;
    let statsInserted = 0;
    let statsSkippedLowRisk = 0;
    let statsSkippedDuplicate = 0;
    let statsSkippedDone = 0;
    let statsSkippedNoSprint = 0;

    if (!board.sprintEndDate) {
      console.log('[AI] Task Deadline: Skipped (no sprintEndDate)');
      statsSkippedNoSprint += totalCards;
    } else if (totalCards === 0) {
      console.log('[AI] Task Deadline: Skipped (no cards)');
    } else {
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

          console.log('--------------------------------------------------');
          console.log('[AI] Task Deadline Evaluation\n');
          console.log(`Board:\n${board.name}\n`);
          console.log(`Board ID:\n${board.id}\n`);
          console.log(`Task ID:\n${card.id}\n`);
          console.log(`Task Title:\n${card.title}\n`);
          console.log(`Current Column:\n${col.name}\n`);
          console.log(`Column ID:\n${col.id}\n`);
          console.log(`Created At:\n${new Date(card.createdAt).toISOString()}\n`);
          console.log(`Updated At:\n${new Date(card.updatedAt).toISOString()}\n`);
          console.log(`Assignee:\n${assigneeName}\n`);
          console.log(`Days Since Update:\n${idleDays.toFixed(1)}\n`);
          console.log(`Sprint Remaining Days:\n${remainingDays.toFixed(1)}\n`);
          console.log(`Sprint Risk:\n${sprintRiskDisplay}\n`);
          console.log(`Score:\n${score}\n`);
          console.log(`Risk:\n${risk}\n`);
          console.log(`Reasons:\n[\n  ${reasons.join(',\n  ')}\n]\n`);
          console.log(`Duplicate Found:\n${duplicateFound}\n`);
          console.log(`Existing Insight ID:\n${existingInsightId}\n`);
          console.log(`Decision:\n${decision}\n`);
          if (decision === 'INSERTED') {
            console.log(`Insight ID:\n${newlyInsertedId}\n`);
          } else {
            console.log(`Reason:\n${reasonText}\n`);
          }
          console.log('--------------------------------------------------');
        }
      }
    }

    console.log('\n========== TASK DEADLINE SUMMARY ==========');
    console.log(`Board:\n${board.name}\n`);
    console.log(`Cards Evaluated:\n${statsEvaluated}\n`);
    console.log(`Inserted:\n${statsInserted}\n`);
    console.log(`Skipped Low Risk:\n${statsSkippedLowRisk}\n`);
    console.log(`Skipped Duplicate:\n${statsSkippedDuplicate}\n`);
    console.log(`Skipped Done:\n${statsSkippedDone}\n`);
    console.log(`Skipped No Sprint:\n${statsSkippedNoSprint}\n`);
    console.log('==========================================\n');
  }

  const duration = Date.now() - start;
  console.log(`[AI] Duration: ${duration}ms`);
  console.log('[AI] Finished');
}
