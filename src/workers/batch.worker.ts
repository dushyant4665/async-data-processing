import { Prisma } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { Worker, type Job } from 'bullmq';
import { prisma } from '../config/database.js';
import {
  BATCH_QUEUE_NAME,
  bullmqConnection,
  PROCESS_BATCH_JOB_NAME,
  type BatchQueuePayload,
  type BatchRecordInput
} from '../queues/batch.queue.js';

const CHUNK_SIZE = 100;

const isPlainRecord = (value: unknown): value is BatchRecordInput => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const saveChunk = async (jobId: string, chunk: unknown[], startRow: number): Promise<void> => {
  const queries: Prisma.PrismaPromise<unknown>[] = [];

  for (let index = 0; index < chunk.length; index += 1) {
    const record = chunk[index];
    const rowNumber = startRow + index + 1;

    if (!isPlainRecord(record) || Object.keys(record).length === 0) {
      queries.push(
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

    queries.push(
      prisma.ingestedRecord.create({
        data: {
          batchJobId: jobId,
          rowNumber,
          payload: record as InputJsonValue
        }
      })
    );
  }

  if (queries.length > 0) {
    await prisma.$transaction(queries);
  }
};

export const startBatchWorker = (): Worker<BatchQueuePayload> => {
  return new Worker<BatchQueuePayload>(
    BATCH_QUEUE_NAME,
    async (job: Job<BatchQueuePayload>) => {
      if (job.name !== PROCESS_BATCH_JOB_NAME) {
        throw new Error(`Unexpected job name: ${job.name}`);
      }

      const { jobId, rawRecords } = job.data;

      try {
        const parsedRecords: unknown = JSON.parse(rawRecords);

        if (!Array.isArray(parsedRecords)) {
          throw new Error('request body must be a JSON array');
        }

        const records = parsedRecords as unknown[];
        const totalRows = records.length;

        await prisma.batchJob.update({
          where: { id: jobId },
          data: {
            status: 'PROCESSING',
            totalRows,
            processedRows: 0
          }
        });

        for (let start = 0; start < totalRows; start += CHUNK_SIZE) {
          const chunk = records.slice(start, start + CHUNK_SIZE);
          await saveChunk(jobId, chunk, start);

          const processedRows = Math.min(start + chunk.length, totalRows);

          await prisma.batchJob.update({
            where: { id: jobId },
            data: {
              processedRows,
              status: processedRows >= totalRows ? 'COMPLETED' : 'PROCESSING'
            }
          });
        }

        return {
          jobId,
          totalRows,
          processedRows: totalRows
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Worker failed';

        await prisma.$transaction([
          prisma.jobError.create({
            data: {
              batchJobId: jobId,
              rowNumber: 0,
              reason: message
            }
          }),
          prisma.batchJob.update({
            where: { id: jobId },
            data: { status: 'FAILED' }
          })
        ]);

        throw error;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: 2
    }
  );
};
