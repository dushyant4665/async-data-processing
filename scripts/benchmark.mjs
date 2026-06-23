import { performance } from 'node:perf_hooks';

const recordCount = Number(process.env.RECORD_COUNT ?? 50000);
const chunkSize = Number(process.env.CHUNK_SIZE ?? 100);

const makeRecords = (count) => {
  const records = [];

  for (let index = 0; index < count; index += 1) {
    records.push({
      id: index + 1,
      name: `user-${index + 1}`,
      value: `payload-${index + 1}`
    });
  }

  return records;
};

const waitOneTick = () => new Promise((resolve) => setImmediate(resolve));

const measure = async (name, task) => {
  const startedAt = performance.now();
  const checksum = await task();
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));

  return { name, elapsedMs, checksum };
};

const processAllAtOnce = async (records) => {
  let checksum = 0;

  for (const record of records) {
    checksum += record.id;
  }

  return checksum;
};

const processInChunks = async (records) => {
  let checksum = 0;

  for (let start = 0; start < records.length; start += chunkSize) {
    const chunk = records.slice(start, start + chunkSize);

    for (const record of chunk) {
      checksum += record.id;
    }

    await waitOneTick();
  }

  return checksum;
};

const records = makeRecords(recordCount);
const syncResult = await measure('sync', () => processAllAtOnce(records));
const asyncResult = await measure('chunked', () => processInChunks(records));
const gain = syncResult.elapsedMs === 0 ? 0 : ((syncResult.elapsedMs - asyncResult.elapsedMs) / syncResult.elapsedMs) * 100;

console.log(
  JSON.stringify(
    {
      recordCount,
      chunkSize,
      sync: syncResult,
      chunked: asyncResult,
      estimatedGainPercent: Number(gain.toFixed(2)),
      note: 'This is a simple local benchmark for comparing one-shot work vs chunked work.'
    },
    null,
    2
  )
);
