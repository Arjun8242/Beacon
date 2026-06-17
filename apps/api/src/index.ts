import express from 'express';
import { prisma } from 'database';
import authRouter from './routes/auth';
import monitorsRouter from './routes/monitors';
import metricsRouter from './routes/metrics';
import dashboardRouter from './routes/dashboard';
import statusRouter from './routes/status';
import { errorHandler } from './errorHandler';

// Global error handlers to prevent silent crashes in production
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', db: 'Connected' });
  } catch {
    res.status(500).json({ status: 'DOWN', db: 'Disconnected' });
  }
});

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/monitors', monitorsRouter);
app.use('/api/v1/monitors/:id', metricsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/status', statusRouter);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Service listening on port ${PORT}`);
});
