import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { createBatchJob } from './controllers/batch.controller.js';
import { batchQueue } from './queues/batch.queue.js';
import { initializeSocketService } from './services/socket.service.js';
import { startBatchWorker } from './workers/batch.worker.js';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.text({ type: ['application/json', 'text/plain'], limit: '25mb' }));

initializeSocketService(server);
const worker = startBatchWorker();

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/batch', createBatchJob);

const port = Number(process.env.PORT ?? 3001);

const shutdown = async (): Promise<void> => {
  await worker.close().catch(() => undefined);
  await batchQueue.close().catch(() => undefined);
  await prisma.$disconnect();
  await redisConnection.quit().catch(() => undefined);

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(port, () => {
  console.log(`Batch engine listening on port ${port}`);
});
