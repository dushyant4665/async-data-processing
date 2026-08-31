import { Worker } from 'bullmq';
import { BATCH_QUEUE_NAME, PROCESS_BATCH_JOB_NAME } from '../queues/batch.queue.js';
import { redisConnection } from '../config/redis.js';
import { processBatchJob, markBatchJobFailed } from '../services/batch.service.js';

export function startBatchWorker(): Worker {
  return new Worker(
    BATCH_QUEUE_NAME,
    async (job) => {
      if (job.name !== PROCESS_BATCH_JOB_NAME) {
        throw new Error('Unexpected job name');
      }

      try {
        return await processBatchJob(job.data);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Worker failed';
        await markBatchJobFailed(job.data.jobId, message);
        throw error;
      }
    },
    { connection: redisConnection as any, concurrency: 2 }
  );
}
