# async-data-processing-pipeline
High-throughput asynchronous batch data ingestion engine built with Node.js, TypeScript, and PostgreSQL. Decouples heavy parsing operations from the main Express event loop using a serverless Redis BullMQ queue. Implements memory-safe execution loops chunked at 100 rows with real-time progress broadcasts via Socket.io WebSockets.
