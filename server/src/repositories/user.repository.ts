import { prisma } from '../utils/prisma';
import { User, AuthProvider } from '@prisma/client';

export class UserRepository {
  async findByDisplayName(displayName: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { displayName: { equals: displayName, mode: 'insensitive' } },
    });
  }

  async create(displayName: string): Promise<User> {
    return prisma.user.create({
      data: { displayName },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async createWithAuth(data: { displayName: string; email: string; passwordHash: string; authProvider: AuthProvider }): Promise<User> {
    return prisma.user.create({
      data: {
        displayName: data.displayName,
        email: data.email,
        passwordHash: data.passwordHash,
        authProvider: data.authProvider,
      },
    });
  }

  async updateDisplayName(id: string, displayName: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { displayName },
    });
  }
}

export const userRepository = new UserRepository();
