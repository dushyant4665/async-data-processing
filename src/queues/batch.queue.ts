import { Queue, type ConnectionOptions } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export type BatchRecordInput = Record<string, unknown>;

export interface BatchQueuePayload {
  jobId: string;
  fileName: string;
  rawRecords: string;
}

export const BATCH_QUEUE_NAME = 'batch-processing-queue';
export const PROCESS_BATCH_JOB_NAME = 'process-batch' as const;
export const bullmqConnection = redisConnection as unknown as ConnectionOptions;

export const batchQueue = new Queue<BatchQueuePayload>(BATCH_QUEUE_NAME, {
  connection: bullmqConnection
});