import { prisma } from '../config/database.js';
import { batchQueue, PROCESS_BATCH_JOB_NAME, type BatchQueuePayload } from '../queues/batch.queue.js';

const CHUNK_SIZE = 100;

function isValidRecord(record: unknown): record is Record<string, unknown> {
  return typeof record === 'object' && record !== null && !Array.isArray(record) && Object.keys(record).length > 0;
}

export async function createBatchJobFromRawText(rawBody: unknown): Promise<{ jobId: string }> {
  if (typeof rawBody !== 'string' || rawBody.trim() === '') {
    throw new Error('request body must contain a JSON array string');
  }

  const fileName = `batch-${Date.now()}.json`;
  const job = await prisma.batchJob.create({
    data: { fileName, status: 'PENDING', totalRows: 0, processedRows: 0 },
  });

  try {
    await batchQueue.add(
      PROCESS_BATCH_JOB_NAME,
      { jobId: job.id, fileName, rawRecords: rawBody },
      { jobId: job.id, removeOnComplete: true, removeOnFail: false },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue batch job';
    await markBatchJobFailed(job.id, message);
    throw new Error(message);
  }

  return { jobId: job.id };
}

export async function processBatchJob(payload: BatchQueuePayload) {
  const parsed = JSON.parse(payload.rawRecords);

  if (!Array.isArray(parsed)) {
    throw new Error('request body must be a JSON array');
  }

  const records = parsed as unknown[];

  for (let start = 0; start < records.length; start += CHUNK_SIZE) {
    const chunk = records.slice(start, start + CHUNK_SIZE);

    for (const [index, record] of chunk.entries()) {
      const rowNumber = start + index + 1;

      if (!isValidRecord) {
        await prisma.jobError.create({ data: { batchJobId: payload.jobId, rowNumber, reason: 'Invalid record format' } });
      } else {
        await prisma.ingestedRecord.create({ data: { batchJobId: payload.jobId, rowNumber, payload: record as any } });
      }
    }

  }

  await prisma.batchJob.update({
    where: { id: payload.jobId },
    data: { status: 'COMPLETED', totalRows: records.length, processedRows: records.length },
  });

  return { jobId: payload.jobId, totalRows: records.length, processedRows: records.length };
}

export async function getBatchJobById(jobId: string) {
  return prisma.batchJob.findUnique({
    where: { id: jobId },
    include: { _count: { select: { records: true, errors: true } } },
  });
}

export async function markBatchJobFailed(jobId: string, reason: string): Promise<void> {
  await prisma.jobError.create({ data: { batchJobId: jobId, rowNumber: 0, reason } });
  await prisma.batchJob.update({ where: { id: jobId }, data: { status: 'FAILED' } });
}
