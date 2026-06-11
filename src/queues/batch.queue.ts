import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export interface BatchRecordInput {
  [key: string]: unknown;
}

export interface BatchQueuePayload {
  jobId: string;
  fileName: string;
  rawRecords: string;
}

export const BATCH_QUEUE_NAME = 'batch-processing-queue';

export const batchQueue = new Queue<BatchQueuePayload>(BATCH_QUEUE_NAME, {
  connection: redisConnection
});
