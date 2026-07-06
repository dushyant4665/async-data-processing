import { Worker } from 'bullmq';
import {
  BATCH_QUEUE_NAME,
  bullmqConnection,
  PROCESS_BATCH_JOB_NAME
} from '../queues/batch.queue.js';
import { markBatchJobFailed, processBatchJob } from '../services/batch.service.js';

export const startBatchWorker = () => {
  return new Worker(
    BATCH_QUEUE_NAME,
    async (job: any) => {
      if (job.name !== PROCESS_BATCH_JOB_NAME) {
        throw new Error('Unexpected job name');
      }

      const jobId = job.data.jobId;

      try {
        return await processBatchJob(job.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Worker failed';
        await markBatchJobFailed(jobId, message);

        throw error;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: 2
    }
  );
};
