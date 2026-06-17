import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createBatchJob } from './controllers/batch.controller.js';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';

const app = express();
let httpServer: ReturnType<typeof app.listen> | null = null;

app.use(cors());
app.use(express.text({ type: ['application/json', 'text/plain'], limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/batch', createBatchJob);

const port = Number(process.env.PORT ?? 3001);

const shutdown = async (): Promise<void> => {
  await prisma.$disconnect();
  await redisConnection.quit().catch(() => undefined);

  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer?.close(() => resolve());
    });
  }

  process.exit(0);
};

httpServer = app.listen(port, () => {
  console.log(`Batch engine listening on port ${port}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
