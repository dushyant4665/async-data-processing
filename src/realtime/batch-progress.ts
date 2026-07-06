import type { Server } from 'socket.io';
import { redisConnection } from '../config/redis.js';

export interface BatchProgressEvent {
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  processedRows: number;
  reason?: string;
}

export const BATCH_PROGRESS_CHANNEL = 'batch-progress';
export const BATCH_PROGRESS_EVENT = 'batch:progress';

export const getBatchRoom = (jobId: string): string => {
  return 'batch-job:' + jobId;
};

export const publishBatchProgress = async (event: BatchProgressEvent): Promise<void> => {
  await redisConnection.publish(BATCH_PROGRESS_CHANNEL, JSON.stringify(event));
};

export const startBatchProgressRelay = async (io: Server): Promise<() => Promise<void>> => {
  const subscriber = redisConnection.duplicate();

  const onMessage = (channel: string, message: string): void => {
    if (channel !== BATCH_PROGRESS_CHANNEL) {
      return;
    }

    let event: BatchProgressEvent;

    try {
      event = JSON.parse(message);
    } catch {
      return;
    }

    if (!event || !event.jobId) {
      return;
    }

    io.to(getBatchRoom(event.jobId)).emit(BATCH_PROGRESS_EVENT, event);
  };

  subscriber.on('message', onMessage);
  await subscriber.subscribe(BATCH_PROGRESS_CHANNEL);

  return async (): Promise<void> => {
    subscriber.off('message', onMessage);
    await subscriber.unsubscribe(BATCH_PROGRESS_CHANNEL).catch(() => undefined);
    await subscriber.quit().catch(() => undefined);
  };
};
