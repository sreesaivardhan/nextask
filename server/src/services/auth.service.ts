import { userRepository } from '../repositories/user.repository';
import { sessionRepository } from '../repositories/session.repository';
import { User, Session, AuthProvider } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { emailService } from './email.service';

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
  async forgotPassword(email: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(trimmedEmail);
    if (!user) {
      // Return successfully to prevent email enumeration
      return;
    }

    const resetTokenPart = crypto.randomBytes(32).toString('hex');
    const resetToken = `${user.id}.${resetTokenPart}`;
    const resetTokenHash = await bcrypt.hash(resetTokenPart, 10);
    const resetTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await userRepository.setResetToken(user.id, resetTokenHash, resetTokenExpiresAt);

    await emailService.sendResetPasswordEmail({
      to: user.email!,
      resetToken,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid or expired reset token');
    }

    const [userId, resetTokenPart] = parts;
    const user = await userRepository.findById(userId);

    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      throw new Error('Invalid or expired reset token');
    }

    if (user.resetTokenExpiresAt < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const isMatch = await bcrypt.compare(resetTokenPart, user.resetTokenHash);
    if (!isMatch) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePassword(user.id, passwordHash);
  }
}

export const authService = new AuthService();
