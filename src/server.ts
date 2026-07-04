import 'dotenv/config';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createBatchJob, getBatchJob } from './controllers/batch.controller.js';
import { prisma } from './config/database.js';
import { redisConnection } from './config/redis.js';
import { getBatchRoom, startBatchProgressRelay } from './realtime/batch-progress.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});
let stopRelay = async (): Promise<void> => undefined;

app.use(cors());
app.use(express.text({ type: ['application/json', 'text/plain'], limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/batch', createBatchJob);
app.get('/api/batch/:jobId', getBatchJob);

io.on('connection', (socket) => {
  socket.on('batch:join', (payload: { jobId?: string }) => {
    const jobId = payload?.jobId?.trim();

    if (!jobId) {
      socket.emit('batch:error', { message: 'jobId is required' });
      return;
    }

    socket.join(getBatchRoom(jobId));
    socket.emit('batch:joined', { jobId });
  });
});

const port = Number(process.env.PORT ?? 3001);

const shutdown = async (): Promise<void> => {
  await stopRelay().catch(() => undefined);
  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
  await prisma.$disconnect();
  await redisConnection.quit().catch(() => undefined);
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  process.exit(0);
};

const bootstrap = async (): Promise<void> => {
  try {
    stopRelay = await startBatchProgressRelay(io);
  } catch (error) {
    console.warn('Batch progress relay could not start', error);
  }

  httpServer.listen(port, () => {
    console.log(`Batch engine listening on port ${port}`);
  });
};

void bootstrap().catch((error) => {
  console.error('Failed to start batch engine', error);
  process.exit(1);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
