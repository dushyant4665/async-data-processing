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

const joinedJobs = new Map<string, Set<string>>();

const addSocketToJob = (socketId: string, jobId: string): void => {
  const jobs = joinedJobs.get(socketId) ?? new Set<string>();
  jobs.add(jobId);
  joinedJobs.set(socketId, jobs);
};

const removeSocketFromJob = (socketId: string, jobId: string): void => {
  const jobs = joinedJobs.get(socketId);
  if (!jobs) {
    return;
  }

  jobs.delete(jobId);

  if (jobs.size === 0) {
    joinedJobs.delete(socketId);
  } else {
    joinedJobs.set(socketId, jobs);
  }
};

const clearSocketJobs = (socketId: string): void => {
  joinedJobs.delete(socketId);
};

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
        const roomId = jobId.trim();
        socket.join(roomId);
        addSocketToJob(socket.id, roomId);
      }
    });

    socket.on('leave-job', (jobId: string) => {
      if (typeof jobId === 'string' && jobId.trim().length > 0) {
        const roomId = jobId.trim();
        socket.leave(roomId);
        removeSocketFromJob(socket.id, roomId);
      }
    });

    socket.on('disconnect', () => {
      clearSocketJobs(socket.id);
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
