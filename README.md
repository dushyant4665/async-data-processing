# Distributed Loader

Everyone builds CRUD APIs, but this project is built for scale.

It is an asynchronous distributed batch ingestion engine using TypeScript, Node.js, PostgreSQL, Redis, BullMQ, Prisma, and Socket.IO.

## What it does

1. Express accepts a raw JSON array payload.
2. Prisma writes a `BatchJob` row with `PENDING` status.
3. BullMQ pushes the raw payload into Redis.
4. The API returns `202 Accepted` immediately with a `jobId`.
5. A background worker processes rows in chunks of 100.
6. Progress and errors are written back to PostgreSQL.
7. Live progress is streamed to the exact Socket.IO room for that `jobId`.

## Architecture

```mermaid
flowchart LR
  A[Client] --> B[Express API]
  B --> C[Prisma writes BatchJob = PENDING]
  B --> D[BullMQ Queue in Redis]
  B --> E[HTTP 202 Accepted]
  D --> F[Worker Node]
  F --> G[Parse JSON in worker]
  G --> H[Process 100 rows per chunk]
  H --> I[PostgreSQL: processedRows + JobError]
  H --> J[Socket.IO room = jobId]
  J --> A
  I --> C
```

## Architectural Mechanics

### 1. Fast HTTP 202

The request path only handles metadata, creates the job row, and queues the payload.
The response returns immediately so the API thread does not sit and wait for the batch to finish.

### 2. Memory-Safe Workers

The worker processes records in chunks of 100.
That keeps the execution loop small and easy to reason about under heavy load.

### 3. Live Telemetry

After each chunk, the worker updates `processedRows` in PostgreSQL and emits progress to the room named after the `jobId`.
That means only the correct client gets the live updates.

## Why this design is strong

- The API stays fast under heavy payloads.
- The worker owns the slow work.
- PostgreSQL remains the source of truth for job state.
- Socket.IO avoids polling and gives real-time progress.
- BullMQ and Redis decouple ingestion from execution.

## Main files

- [src/server.ts](src/server.ts) boots Express, Socket.IO, and the worker.
- [src/controllers/batch.controller.ts](src/controllers/batch.controller.ts) accepts the request and creates the job.
- [src/queues/batch.queue.ts](src/queues/batch.queue.ts) defines the BullMQ queue.
- [src/workers/batch.worker.ts](src/workers/batch.worker.ts) processes records in the background.
- [src/services/socket.service.ts](src/services/socket.service.ts) manages room joins and progress events.
- [prisma/schema.prisma](prisma/schema.prisma) defines `BatchJob` and `JobError`.

## Environment

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/distributed_loader
REDIS_URL=redis://127.0.0.1:6379
```

## Run locally

```bash
npm install
npx prisma generate
npm run dev
```

## Request shape

Send raw JSON text containing an array:

```json
[{"name":"A"},{"name":"B"}]
```

## Interview Pitch

> I engineered an asynchronous distributed batch ingestion engine using TypeScript, Node.js, and PostgreSQL. Express registers metadata through Prisma, delegates the payload to a BullMQ Redis queue, and returns `202 Accepted` immediately. Background workers process rows in chunks of 100, keep the execution loop small, update progress in PostgreSQL, and stream live metrics back to the exact Socket.IO room for that job.

## Honest note

The code is designed for low memory pressure and clean scaling behavior, but exact memory numbers like "under 30MB" depend on payload shape, runtime settings, and database load.
