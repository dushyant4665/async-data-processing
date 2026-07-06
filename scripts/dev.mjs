import { spawn } from 'node:child_process';

const api = spawn('npm', ['run', 'dev:api'], {
  stdio: 'inherit',
  shell: true
});

const worker = spawn('npm', ['run', 'dev:worker'], {
  stdio: 'inherit',
  shell: true
});

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
