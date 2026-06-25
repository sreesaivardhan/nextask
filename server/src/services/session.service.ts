import { userRepository } from '../repositories/user.repository';
import { sessionRepository } from '../repositories/session.repository';
import { User, Session } from '@prisma/client';

export class SessionService {
  async createUser(displayName: string): Promise<User> {
    const trimmed = displayName.trim();
    if (!trimmed) {
      throw new Error('Display name is required');
    }

    return userRepository.create(trimmed);
  }

  async createSession(userId: string): Promise<Session> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return sessionRepository.create(userId, expiresAt);
  }

  async validateSession(sessionId: string): Promise<User | null> {
    const session = await sessionRepository.findById(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    return userRepository.findById(session.userId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await sessionRepository.delete(sessionId);
  }
}

export const sessionService = new SessionService();
