import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateDigests } from '../services/digest.service';
import { authzService } from '../services/authorization.service';

const prisma = new PrismaClient();

export const getLatestDigest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.session!.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

    const digest = await prisma.weeklyDigest.findFirst({
      where: { boardId },
      orderBy: { generatedAt: 'desc' }
    });
    
    res.json(digest || null);
  } catch (error: unknown) {
    console.error('[Digest] getLatestDigest error:', error);
    let status = 500;
    let message = 'Failed to fetch latest digest';
    if (error instanceof Error) {
      message = error.message;
      if ('status' in error && typeof (error as Record<string, unknown>).status === 'number') {
        status = (error as Record<string, unknown>).status as number;
      }
    }
    res.status(status).json({ error: message });
  }
};

export const getDigests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.session!.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

    const digests = await prisma.weeklyDigest.findMany({
      where: { boardId },
      orderBy: { generatedAt: 'desc' }
    });
    
    res.json(digests);
  } catch (error: unknown) {
    console.error('[Digest] getDigests error:', error);
    let status = 500;
    let message = 'Failed to fetch digests';
    if (error instanceof Error) {
      message = error.message;
      if ('status' in error && typeof (error as Record<string, unknown>).status === 'number') {
        status = (error as Record<string, unknown>).status as number;
      }
    }
    res.status(status).json({ error: message });
  }
};

export const generateDigest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.session!.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN']);

    await generateDigests(boardId);
    
    const digest = await prisma.weeklyDigest.findFirst({
      where: { boardId },
      orderBy: { generatedAt: 'desc' }
    });
    
    res.json(digest);
  } catch (error: unknown) {
    console.error('[Digest] generateDigest error:', error);
    let status = 500;
    let message = 'Failed to generate digest';
    if (error instanceof Error) {
      message = error.message;
      if ('status' in error && typeof (error as Record<string, unknown>).status === 'number') {
        status = (error as Record<string, unknown>).status as number;
      }
    }
    res.status(status).json({ error: message });
  }
};
