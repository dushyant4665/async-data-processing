import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

export interface JobProgressPayload {
  jobId: string;
  processedRows: number;
  totalRows: number;
  percentage: number;
  status: string;
}

let io: SocketIOServer | null = null;

export const initializeSocketService = (server: HttpServer): SocketIOServer => {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-job', (jobId: string) => {
      if (typeof jobId === 'string' && jobId.trim().length > 0) {
        socket.join(jobId.trim());
      }
    });

    socket.on('leave-job', (jobId: string) => {
      if (typeof jobId === 'string' && jobId.trim().length > 0) {
        socket.leave(jobId.trim());
      }
    });
  });

  return io;
};

export const emitJobProgress = (payload: JobProgressPayload): void => {
  io?.to(payload.jobId).emit('job-progress', payload);
};

export const emitJobCompleted = (jobId: string): void => {
  io?.to(jobId).emit('job-completed', { jobId, status: 'COMPLETED' });
};

export const emitJobFailed = (jobId: string, message: string): void => {
  io?.to(jobId).emit('job-failed', { jobId, status: 'FAILED', message });
};
