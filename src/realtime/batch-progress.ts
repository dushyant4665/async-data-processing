import type { Server } from 'socket.io';
import { redisConnection } from '../config/redis.js';

export type BatchJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BatchProgressEvent {
  jobId: string;
  status: BatchJobStatus;
  totalRows: number;
  processedRows: number;
  reason?: string;
}

export const BATCH_PROGRESS_CHANNEL = 'batch-progress';
export const BATCH_PROGRESS_EVENT = 'batch:progress';

export const getBatchRoom = (jobId: string): string => `batch-job:${jobId}`;

export const publishBatchProgress = async (event: BatchProgressEvent): Promise<void> => {
  await redisConnection.publish(BATCH_PROGRESS_CHANNEL, JSON.stringify(event));
};

export const emitBatchProgressSafely = async (event: BatchProgressEvent): Promise<void> => {
  await publishBatchProgress(event).catch(() => undefined);
};

export const startBatchProgressRelay = async (io: Server): Promise<(() => Promise<void>)> => {
  const subscriber = redisConnection.duplicate();

  const onMessage = (channel: string, message: string): void => {
    if (channel !== BATCH_PROGRESS_CHANNEL) {
      return;
    }

    try {
      const event = JSON.parse(message) as BatchProgressEvent;
      if (!event || typeof event.jobId !== 'string') {
        return;
      }

      io.to(getBatchRoom(event.jobId)).emit(BATCH_PROGRESS_EVENT, event);
    } catch {
      // Ignore malformed pub/sub payloads so one bad message does not break the relay.
    }
  };

  const start = async (): Promise<void> => {
    subscriber.on('message', onMessage);
    await subscriber.subscribe(BATCH_PROGRESS_CHANNEL);
  };

  try {
    await start();
  } catch (error) {
    subscriber.off('message', onMessage);
    await subscriber.quit().catch(() => undefined);
    throw error;
  }

  return async (): Promise<void> => {
    subscriber.off('message', onMessage);
    await subscriber.unsubscribe(BATCH_PROGRESS_CHANNEL).catch(() => undefined);
    await subscriber.quit().catch(() => undefined);
  };
};
