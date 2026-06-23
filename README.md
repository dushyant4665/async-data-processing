# Asynchronous Batch Ingestion Engine

This project accepts a large JSON array as raw text, stores a job in PostgreSQL, pushes the work to Redis/BullMQ, and processes it in a separate worker process.

## How it works

```mermaid
flowchart LR
  A[Client] --> B[API]
  B --> C[(PostgreSQL)]
  B --> D[Redis Queue]
  D --> E[Worker]
  E --> C
```

1. Client sends raw JSON array text.
2. API creates a `BatchJob`.
3. API adds the job to BullMQ.
4. Worker reads the job and processes records in chunks.
5. Valid rows go into `IngestedRecord`.
6. Bad rows go into `JobError`.
## Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Docker

## What is implemented

- API accepts raw JSON array text and returns quickly with a queued job id.
- Worker processes records in small chunks of 100 so memory use stays lower.
- PostgreSQL stores job state, valid rows, and row-level errors.
- Redis + BullMQ handles background processing.
- Docker runs API, worker, Postgres, and Redis together.
- `npm run benchmark` compares one-shot processing with chunked async processing.

## Run locally

```bash
npm install
npx prisma generate
npm run prisma:deploy
npm run dev
```

## Docker

```bash
docker compose up --build
```

## Environment

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/distributed_loader
REDIS_URL=redis://127.0.0.1:6379
```

## Request

Send a raw JSON array:

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

## Check Job Status

Get one batch job by id:

```http
GET /api/batch/:jobId
```

Response includes the job status, row counts, and record/error totals.
