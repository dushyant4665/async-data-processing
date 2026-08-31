import type { Request, Response } from 'express';
import { createBatchJobFromRawText, getBatchJobById } from '../services/batch.service.js';

export async function createBatchJob(req: Request, res: Response) {
  try {
    const { jobId } = await createBatchJobFromRawText(req.body);

    res.status(202).json({
      success: true,
      message: 'Batch accepted and queued',
      jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create batch job';
    const status = message.includes('request body') ? 400 : 500;

    res.status(status).json({ success: false, message });
  }
}

export async function getBatchJob(req: Request, res: Response) {
  const jobId = req.params.jobId?.trim();

  if (!jobId) {
    res.status(400).json({ success: false, message: 'jobId is required' });
    return;
  }

  const job = await getBatchJobById(jobId);

  if (!job) {
    res.status(404).json({ success: false, message: 'Batch job not found' });
    return;
  }

  res.status(200).json({ success: true, data: job });
}
