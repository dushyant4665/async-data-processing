import 'dotenv/config';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';
import { startBatchWorker } from './workers/batch.worker.js';

const worker = startBatchWorker();

const shutdown = async (): Promise<void> => {
  await worker.close().catch(() => undefined);
  await prisma.$disconnect();
  await redisConnection.quit().catch(() => undefined);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Batch worker listening for queued jobs');
