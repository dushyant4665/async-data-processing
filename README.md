# Asynchronous Data Processing Pipeline

A simple batch processing system built with Node.js, TypeScript, Express, PostgreSQL, Prisma, Redis, BullMQ, and Socket.IO.

## What It Does

- Accepts one raw JSON array payload.
- Creates a `BatchJob` row in PostgreSQL with `PENDING` status.
- Sends the raw payload to BullMQ in Redis.
- Returns `202 Accepted` immediately with a `jobId`.
- Processes records in chunks of 100 inside a worker.
- Stores progress and errors in PostgreSQL.
- Sends live progress updates to the correct Socket.IO room.

## Flow

1. Client sends a heavy JSON array.
2. Express saves job metadata with Prisma.
3. BullMQ queues the raw payload.
4. Worker parses and processes the data in chunks.
5. PostgreSQL stores `processedRows` and `JobError` records.
6. Socket.IO emits progress to the matching `jobId` room.

## Stack

- TypeScript
- Node.js
- Express
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- Socket.IO

## Project Files

- [src/server.ts](src/server.ts) starts the app.
- [src/controllers/batch.controller.ts](src/controllers/batch.controller.ts) handles the request and queues the job.
- [src/queues/batch.queue.ts](src/queues/batch.queue.ts) defines the BullMQ queue.
- [src/workers/batch.worker.ts](src/workers/batch.worker.ts) processes records in the background.
- [src/services/socket.service.ts](src/services/socket.service.ts) handles rooms and events.
- [prisma/schema.prisma](prisma/schema.prisma) defines the database schema.

## Environment

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/distributed_loader
REDIS_URL=redis://127.0.0.1:6379
```

## Run

```bash
npm install
npx prisma generate
npm run dev
```

## Request Body

Send raw JSON text containing an array:

```json
[{"name":"A"},{"name":"B"}]
```

## Response

```json
{
  "success": true,
  "message": "Batch accepted and queued",
  "jobId": "uuid"
}
```

