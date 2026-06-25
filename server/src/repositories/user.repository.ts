import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';

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
}

export const userRepository = new UserRepository();
