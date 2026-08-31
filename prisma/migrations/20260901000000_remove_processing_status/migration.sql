-- Jobs left in the old intermediate state can be picked up again.
UPDATE "BatchJob" SET "status" = 'PENDING' WHERE "status" = 'PROCESSING';

ALTER TYPE "BatchJobStatus" RENAME TO "BatchJobStatus_old";
CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

ALTER TABLE "BatchJob" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BatchJob"
  ALTER COLUMN "status" TYPE "BatchJobStatus"
  USING ("status"::text::"BatchJobStatus");
ALTER TABLE "BatchJob" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "BatchJobStatus_old";
