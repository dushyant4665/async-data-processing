import { spawn } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const api = spawn(npmCmd, ['run', 'dev:api'], { stdio: 'inherit' });
const worker = spawn(npmCmd, ['run', 'dev:worker'], { stdio: 'inherit' });

const shutdown = () => {
  api.kill();
  worker.kill();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

api.on('exit', (code) => {
  worker.kill();
  process.exit(code ?? 0);
});

worker.on('exit', (code) => {
  api.kill();
  process.exit(code ?? 0);
});
