import type { Request, Response } from 'express';
import {
  batchQueue,
  PROCESS_BATCH_JOB_NAME,
  type BatchQueuePayload
} from '../queues/batch.queue.js';
import { prisma } from '../config/database.js';

export const createBatchJob = async (
  req: Request<unknown, unknown, string>,
  res: Response
): Promise<Response> => {
  let createdJobId: string | null = null;
  let failureMessage = 'Failed to create batch job';

  try {
    const rawBody = req.body;
    const fileName = `batch-${Date.now()}.json`;

    if (typeof rawBody !== 'string' || rawBody.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'request body must contain a JSON array string'
      });
    }

    const job = await prisma.batchJob.create({
      data: {
        fileName,
        totalRows: 0,
        status: 'PENDING'
      }
    });
    createdJobId = job.id;

    const payload: BatchQueuePayload = {
      jobId: job.id,
      fileName,
      rawRecords: rawBody
    };

    await batchQueue.add(PROCESS_BATCH_JOB_NAME, payload, {
      jobId: job.id,
      removeOnComplete: true,
      removeOnFail: false
    });

    return res.status(202).json({
      success: true,
      message: 'Batch accepted and queued',
      jobId: job.id
    });
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : failureMessage;

    if (createdJobId) {
      await prisma.$transaction([
        prisma.jobError.create({
          data: {
            batchJobId: createdJobId,
            rowNumber: 0,
            reason: failureMessage
          }
        }),
        prisma.batchJob.update({
          where: { id: createdJobId },
          data: { status: 'FAILED' }
        })
      ]);
    }

    return res.status(400).json({
      success: false,
      message: failureMessage
    });
  }
};
