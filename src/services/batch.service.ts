import { Prisma } from '@prisma/client';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { prisma } from '../config/database.js';
import {
  batchQueue,
  PROCESS_BATCH_JOB_NAME,
  type BatchQueuePayload,
  type BatchRecordInput
} from '../queues/batch.queue.js';

const CHUNK_SIZE = 100;

const isPlainRecord = (value: unknown): value is BatchRecordInput => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const makeBatchFileName = (): string => {
  return `batch-${Date.now()}.json`;
};

const failBatchJob = async (jobId: string, reason: string): Promise<void> => {
  await prisma.$transaction([
    prisma.jobError.create({
      data: {
        batchJobId: jobId,
        rowNumber: 0,
        reason
      }
    }),
    prisma.batchJob.update({
      where: { id: jobId },
      data: { status: 'FAILED' }
    })
  ]);
};

const saveChunk = async (jobId: string, records: unknown[], startRow: number): Promise<void> => {
  const queries: Prisma.PrismaPromise<unknown>[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
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

export const createBatchJobFromRawText = async (rawBody: string): Promise<{ jobId: string }> => {
  if (typeof rawBody !== 'string' || rawBody.trim().length === 0) {
    throw new Error('request body must contain a JSON array string');
  }

  const fileName = makeBatchFileName();
  const job = await prisma.batchJob.create({
    data: {
      fileName,
      totalRows: 0,
      status: 'PENDING'
    }
  });

  const payload: BatchQueuePayload = {
    jobId: job.id,
    fileName,
    rawRecords: rawBody
  };

  try {
    await batchQueue.add(PROCESS_BATCH_JOB_NAME, payload, {
      jobId: job.id,
      removeOnComplete: true,
      removeOnFail: false
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Failed to queue batch job';
    await failBatchJob(job.id, reason);
    throw new Error(reason);
  }

  return { jobId: job.id };
};

export const processBatchJob = async (payload: BatchQueuePayload): Promise<{
  jobId: string;
  totalRows: number;
  processedRows: number;
}> => {
  const parsedRecords: unknown = JSON.parse(payload.rawRecords);

  if (!Array.isArray(parsedRecords)) {
    throw new Error('request body must be a JSON array');
  }

  const records = parsedRecords as unknown[];
  const totalRows = records.length;

  await prisma.batchJob.update({
    where: { id: payload.jobId },
    data: {
      status: 'PROCESSING',
      totalRows,
      processedRows: 0
    }
  });

  // Process fixed-size blocks so the worker stays steady on large payloads.
  for (let startRow = 0; startRow < totalRows; startRow += CHUNK_SIZE) {
    const chunk = records.slice(startRow, startRow + CHUNK_SIZE);

    await saveChunk(payload.jobId, chunk, startRow);

    const processedRows = Math.min(startRow + chunk.length, totalRows);

    await prisma.batchJob.update({
      where: { id: payload.jobId },
      data: {
        processedRows,
        status: processedRows >= totalRows ? 'COMPLETED' : 'PROCESSING'
      }
    });
  }

  return {
    jobId: payload.jobId,
    totalRows,
    processedRows: totalRows
  };
};

export const getBatchJobById = async (jobId: string) => {
  return prisma.batchJob.findUnique({
    where: { id: jobId },
    include: {
      _count: {
        select: {
          records: true,
          errors: true
        }
      }
    }
  });
};

export const markBatchJobFailed = async (jobId: string, reason: string): Promise<void> => {
  await failBatchJob(jobId, reason);
};
