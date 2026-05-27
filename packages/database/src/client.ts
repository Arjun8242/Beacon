import { PrismaClient } from '@prisma/client';

const createPrismaClient = () => {
  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof createPrismaClient>;
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
