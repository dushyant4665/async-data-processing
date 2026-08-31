# Asynchronous Batch Ingestion Engine

This app accepts a large JSON array, queues it in Redis, and processes it in a background worker. PostgreSQL stores the batch status, saved records, and invalid-record errors.

## Flow

```mermaid
flowchart LR
  Client --> API
  API --> PostgreSQL
  API --> RedisQueue[Redis / BullMQ]
  RedisQueue --> Worker
  Worker --> PostgreSQL
```

1. Send a JSON array to the API.
2. The API creates a batch with status `PENDING` and queues it.
3. The worker validates and saves each record.
4. The batch becomes `COMPLETED` or `FAILED`.

## Statuses

- `PENDING` - waiting in the queue or being processed.
- `COMPLETED` - all rows were handled.
- `FAILED` - the batch could not be queued or processed.

## Stack

- Node.js and TypeScript
- Express
- PostgreSQL and Prisma
- Redis and BullMQ
- Docker

## Run locally

Install dependencies and generate the Prisma client:

```bash
npm install
npx prisma generate
npm run prisma:deploy
```

Start the API and worker in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:worker
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

## API

### Create a batch

```http
POST /api/batch
Content-Type: application/json
```

Send a raw JSON array as the request body:

```json
[{"name":"A"},{"name":"B"}]
```

The API responds immediately:

```json
{
  "success": true,
  "message": "Batch accepted and queued",
  "jobId": "uuid"
}
```

### Check a batch

```http
GET /api/batch/:jobId
```

The response contains the batch status, row counts, and counts of valid records and errors.
