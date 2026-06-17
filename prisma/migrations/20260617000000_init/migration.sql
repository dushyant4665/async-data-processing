-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "BatchJob" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "BatchJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestedRecord" (
    "id" TEXT NOT NULL,
    "batchJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobError" (
    "id" TEXT NOT NULL,
    "batchJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchJob_status_createdAt_idx" ON "BatchJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IngestedRecord_batchJobId_rowNumber_idx" ON "IngestedRecord"("batchJobId", "rowNumber");

-- CreateIndex
CREATE INDEX "JobError_batchJobId_rowNumber_idx" ON "JobError"("batchJobId", "rowNumber");

-- AddForeignKey
ALTER TABLE "IngestedRecord" ADD CONSTRAINT "IngestedRecord_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BatchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobError" ADD CONSTRAINT "JobError_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BatchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
