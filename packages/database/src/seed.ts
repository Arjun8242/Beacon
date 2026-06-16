import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: { email: 'test@example.com', passwordHash },
  });
  console.log('User:', user.id, user.email);

  // Create test monitor (nextCheckAt = now so it's picked up immediately)
  const monitor = await prisma.monitor.upsert({
    where: { id: 'seed-monitor-001' },
    update: {},
    create: {
      id: 'seed-monitor-001',
      userId: user.id,
      name: 'Google',
      slug:'google',
      url: 'https://www.google.com',
      interval: 60,
      nextCheckAt: new Date(),
    },
  });
  console.log('Monitor:', monitor.id, monitor.url);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
