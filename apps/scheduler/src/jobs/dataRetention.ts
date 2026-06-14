import cron from 'node-cron';
import { prisma } from 'database';

async function cleanupOldData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const result = await prisma.check.deleteMany({
      where: {
        checkedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    
    if (result.count > 0) {
      console.log(JSON.stringify({
        event: 'data_retention_cleanup',
        deletedChecks: result.count,
        threshold: thirtyDaysAgo.toISOString()
      }));
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'data_retention_error',
      error: (error as Error).message
    }));
  }
}

// Run once a day at 2:00 AM server time
cron.schedule('0 2 * * *', cleanupOldData);

console.log(JSON.stringify({ event: 'data_retention_job_registered' }));
