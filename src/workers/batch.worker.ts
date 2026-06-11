import { Prisma } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import { prisma } from '../config/database.js';
import { BATCH_QUEUE_NAME, type BatchQueuePayload, type BatchRecordInput } from '../queues/batch.queue.js';
import { emitJobCompleted, emitJobFailed, emitJobProgress } from '../services/socket.service.js';
import { redisConnection } from '../config/redis.js';

const chunkSize = 100;

const isValidRecord = (record: BatchRecordInput): boolean => {
  return typeof record === 'object' && record !== null && !Array.isArray(record) && Object.keys(record).length > 0;
};

const processChunk = async (
  jobId: string,
  chunk: BatchRecordInput[],
  offset: number
): Promise<void> => {
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (let index = 0; index < chunk.length; index += 1) {
    const record = chunk[index];
    const rowNumber = offset + index + 1;

    if (!isValidRecord(record)) {
      operations.push(
        prisma.jobError.create({
          data: {
            batchJobId: jobId,
            rowNumber,
            reason: 'Invalid record format'
          }
        })
      );
      continue;
    }

    operations.push(prisma.$executeRaw(Prisma.sql`SELECT 1`));
  }

  await prisma.$transaction(operations);
};

const updateProgress = async (jobId: string, processedRows: number, totalRows: number): Promise<void> => {
  const percentage = totalRows === 0 ? 100 : Math.round((processedRows / totalRows) * 100);

  await prisma.batchJob.update({
    where: { id: jobId },
    data: {
      processedRows,
      status: processedRows >= totalRows ? 'COMPLETED' : 'PROCESSING'
    }
  });

  emitJobProgress({
    jobId,
    processedRows,
    totalRows,
    percentage,
    status: processedRows >= totalRows ? 'COMPLETED' : 'PROCESSING'
  });
};

export const startBatchWorker = (): Worker<BatchQueuePayload> => {
  const worker = new Worker<BatchQueuePayload>(
    BATCH_QUEUE_NAME,
    async (job: Job<BatchQueuePayload>) => {
      const { jobId, rawRecords } = job.data;
      const parsedRecords: unknown = JSON.parse(rawRecords);

      if (!Array.isArray(parsedRecords)) {
        throw new Error('request body must be a JSON array');
      }

      const records = parsedRecords as BatchRecordInput[];
      const totalRows = records.length;

      await prisma.batchJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', totalRows }
      });

      let processedRows = 0;

      for (let start = 0; start < totalRows; start += chunkSize) {
        const chunk = records.slice(start, start + chunkSize);

        try {
          await processChunk(jobId, chunk, start);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown chunk error';

          await prisma.jobError.create({
            data: {
              batchJobId: jobId,
              rowNumber: start + 1,
              reason: message
            }
          });
        }

        processedRows = Math.min(start + chunk.length, totalRows);
        await updateProgress(jobId, processedRows, totalRows);
      }

      await prisma.batchJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', processedRows: totalRows }
      });

      emitJobCompleted(jobId);

      return { jobId, totalRows, processedRows: totalRows };
    },
    {
      connection: redisConnection,
      concurrency: 2
    }
  );

  worker.on('failed', async (job, error) => {
    if (job?.data?.jobId) {
      const message = error instanceof Error ? error.message : 'Worker failed';
      await prisma.batchJob.update({
        where: { id: job.data.jobId },
        data: { status: 'FAILED' }
      });
      emitJobFailed(job.data.jobId, message);
    }
  });

  return worker;
};
