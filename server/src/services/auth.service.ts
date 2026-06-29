import { userRepository } from '../repositories/user.repository';
import { sessionRepository } from '../repositories/session.repository';
import { User, Session, AuthProvider } from '@prisma/client';
import bcrypt from 'bcrypt';

export class AuthService {
  private async createSessionForUser(userId: string): Promise<Session> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return sessionRepository.create(userId, expiresAt);
  }

  async register(displayName: string, email: string, password: string):Promise<{user: User, session: Session}> {
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > 50) {
      throw new Error('Display name must be between 1 and 50 characters');
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email address');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const existingUser = await userRepository.findByEmail(trimmedEmail);
    if (existingUser) {
      throw new Error('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await userRepository.createWithAuth({
      displayName: trimmedName,
      email: trimmedEmail,
      passwordHash,
      authProvider: AuthProvider.LOCAL,
    });

    const session = await this.createSessionForUser(user.id);

    return { user, session };
  }

  async login(email: string, password: string): Promise<{user: User, session: Session}> {
    const trimmedEmail = email.trim().toLowerCase();
    
    const user = await userRepository.findByEmail(trimmedEmail);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const session = await this.createSessionForUser(user.id);

    return { user, session };
  }

  async handleOAuthLogin(
    email: string,
    displayName: string,
    authProvider: AuthProvider,
    githubUsername?: string
  ): Promise<{ user: User; session: Session }> {
    const trimmedEmail = email.trim().toLowerCase();
    
    let user = await userRepository.findByEmail(trimmedEmail);
    
    if (!user) {
      user = await userRepository.createOAuthUser({
        email: trimmedEmail,
        displayName: displayName || email.split('@')[0],
        authProvider,
        githubUsername,
      });
    } else if (authProvider === AuthProvider.GITHUB && githubUsername && !user.githubUsername) {
      // Opportunistically link github username if not present
      user = await userRepository.linkGithubUsername(user.id, githubUsername);
    }

    const session = await this.createSessionForUser(user.id);

    return { user, session };
  }
  async updateProfile(userId: string, displayName: string): Promise<User> {
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > 50) {
      throw new Error('Display name must be between 1 and 50 characters');
    }
    return userRepository.updateDisplayName(userId, trimmedName);
  }
}

export const authService = new AuthService();
