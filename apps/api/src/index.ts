import express from 'express';
import { prisma } from 'database';

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', db: 'Connected' });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', db: 'Disconnected' });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Service listening on port ${PORT}`);
});
