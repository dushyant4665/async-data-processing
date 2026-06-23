import { Worker, type Job } from 'bullmq';
import {
  BATCH_QUEUE_NAME,
  bullmqConnection,
  PROCESS_BATCH_JOB_NAME,
  type BatchQueuePayload
} from '../queues/batch.queue.js';
import { markBatchJobFailed, processBatchJob } from '../services/batch.service.js';

export const startBatchWorker = (): Worker<BatchQueuePayload> => {
  return new Worker<BatchQueuePayload>(
    BATCH_QUEUE_NAME,
    async (job: Job<BatchQueuePayload>) => {
      if (job.name !== PROCESS_BATCH_JOB_NAME) {
        throw new Error(`Unexpected job name: ${job.name}`);
      }

      const { jobId } = job.data;

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
