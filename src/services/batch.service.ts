import { prisma } from '../config/database.js';
import { batchQueue, PROCESS_BATCH_JOB_NAME, type BatchQueuePayload } from '../queues/batch.queue.js';

const CHUNK_SIZE = 100;

const isRecord = (value: unknown): boolean => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const failJob = async (jobId: string, reason: string): Promise<void> => {
  await prisma.jobError.create({
    data: {
      batchJobId: jobId,
      rowNumber: 0,
      reason
    }
  });

  await prisma.batchJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED'
    }
  });
};

const saveChunk = async (jobId: string, records: unknown[], startRow: number): Promise<void> => {
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const rowNumber = startRow + i + 1;

    if (!isRecord(record)) {
      await prisma.jobError.create({
        data: {
          batchJobId: jobId,
          rowNumber: rowNumber,
          reason: 'Invalid record format'
        }
      });
      continue;
    }

    const recordData = record as Record<string, unknown>;

    if (Object.keys(recordData).length === 0) {
      await prisma.jobError.create({
        data: {
          batchJobId: jobId,
          rowNumber: rowNumber,
          reason: 'Invalid record format'
        }
      });
      continue;
    }

    await prisma.ingestedRecord.create({
      data: {
        batchJobId: jobId,
        rowNumber: rowNumber,
        payload: recordData as any
      }
    });
  }
};

export const createBatchJobFromRawText = async (rawBody: string): Promise<{ jobId: string }> => {
  if (typeof rawBody !== 'string' || rawBody.trim() === '') {
    throw new Error('request body must contain a JSON array string');
  }

  const fileName = 'batch-' + Date.now() + '.json';
  const job = await prisma.batchJob.create({
    data: {
      fileName,
      status: 'PENDING',
      totalRows: 0,
      processedRows: 0
    }
  });

  try {
    await batchQueue.add(
      PROCESS_BATCH_JOB_NAME,
      {
        jobId: job.id,
        fileName,
        rawRecords: rawBody
      },
      {
        jobId: job.id,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue batch job';
    await failJob(job.id, message);
    throw new Error(message);
  }

  return { jobId: job.id };
};

export const processBatchJob = async (payload: BatchQueuePayload) => {
  const parsed = JSON.parse(payload.rawRecords);

  if (!Array.isArray(parsed)) {
    throw new Error('request body must be a JSON array');
  }

  const records = parsed as unknown[];
  const totalRows = records.length;

  await prisma.batchJob.update({
    where: { id: payload.jobId },
    data: {
      status: 'PROCESSING',
      totalRows: totalRows,
      processedRows: 0
    }
  });

  for (let startRow = 0; startRow < totalRows; startRow += CHUNK_SIZE) {
    const chunk = records.slice(startRow, startRow + CHUNK_SIZE);
    await saveChunk(payload.jobId, chunk, startRow);

    const processedRows = startRow + chunk.length;

    await prisma.batchJob.update({
      where: { id: payload.jobId },
      data: {
        processedRows: processedRows,
        status: processedRows >= totalRows ? 'COMPLETED' : 'PROCESSING'
      }
    });
  }

  return {
    jobId: payload.jobId,
    totalRows: totalRows,
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
  await failJob(jobId, reason);
};
