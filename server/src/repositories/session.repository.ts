import { prisma } from '../utils/prisma';
import { Session } from '@prisma/client';

export class SessionRepository {
  async create(userId: string, expiresAt: Date): Promise<Session> {
    return prisma.session.create({
      data: {
        userId,
        expiresAt,
      },
    });
  }

  async findById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({
      where: { id },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.session.delete({
      where: { id },
    }).catch(() => {}); // Ignore if already deleted
  }
}

export const sessionRepository = new SessionRepository();
