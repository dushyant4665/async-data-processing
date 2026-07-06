import type { Request, Response } from 'express';
import { createBatchJobFromRawText, getBatchJobById } from '../services/batch.service.js';

export const createBatchJob = async (req: Request, res: Response) => {
  try {
    const result = await createBatchJobFromRawText(req.body);
    return res.status(202).json({
      success: true,
      message: 'Batch accepted and queued',
      jobId: result.jobId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create batch job';
    const statusCode = message.includes('request body') ? 400 : 500;
    return res.status(statusCode).json({ success: false, message });
  }
};

export const getBatchJob = async (req: Request, res: Response) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : '';

  if (!jobId || jobId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'jobId is required'
    });
  }

  const job = await getBatchJobById(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Batch job not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: job
  });
};
