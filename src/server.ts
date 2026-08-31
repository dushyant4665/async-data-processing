import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createBatchJob, getBatchJob } from './controllers/batch.controller.js';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';

const app = express();

app.use(cors());
app.use(express.text({ type: ['application/json', 'text/plain'], limit: '25mb' }));

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.post('/api/batch', createBatchJob);
app.get('/api/batch/:jobId', getBatchJob);

const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () => console.log(`Batch engine listening on port ${port}`));

async function shutdown() {
  await new Promise<void>((resolve) => server.close(resolve));
  await prisma.$disconnect();
  await redisConnection.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
