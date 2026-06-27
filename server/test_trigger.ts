import { PrismaClient } from '@prisma/client';
import { cardService } from './src/services/card.service';
const prisma = new PrismaClient();

async function run() {
  const board = await prisma.board.findFirst({ include: { columns: true } });
  if (!board) throw new Error("No board");

  const user = await prisma.user.findUnique({ where: { id: board.ownerId } });
  if (!user) throw new Error("No user");

  console.log("Columns:", board.columns.map(c => c.name));
  
  const todoCol = board.columns[0];
  const doneCol = board.columns[board.columns.length - 1];

  // Create two cards
  console.log("--- Creating Card A ---");
  const cardA = await cardService.createCard(board.id, todoCol.id, user.id, {
    title: 'Card A - Google OAuth',
    description: 'OAuth',
  });
  
  console.log("--- Creating Card B ---");
  await cardService.createCard(board.id, todoCol.id, user.id, {
    title: 'Card B - Implement Google Auth',
    description: 'OAuth implementation',
  });

  await new Promise(resolve => setTimeout(resolve, 3000)); // wait for inference

  // Move Card A to Done
  console.log("--- Moving Card A to Done ---");
  const freshAMove1 = await prisma.card.findUnique({ where: { id: cardA.id } });
  await cardService.moveCard(cardA.id, user.id, freshAMove1!.version, {
    columnId: doneCol.id,
    position: 0
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Accept Card A
  console.log("--- Accepting Card A ---");
  // Fetch fresh version
  const freshA = await prisma.card.findUnique({ where: { id: cardA.id } });
  await cardService.updateCard(cardA.id, user.id, freshA!.version, {
    complexityStatus: 'ACCEPTED',
    complexity: freshA!.suggestedSp || 5
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log("--- Moving Card A to Todo ---");
  const freshA2 = await prisma.card.findUnique({ where: { id: cardA.id } });
  await cardService.moveCard(cardA.id, user.id, freshA2!.version, {
    columnId: todoCol.id,
    position: 0
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log("--- Done ---");
}

run().catch(console.error).finally(() => prisma.$disconnect());
