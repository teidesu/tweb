// Dev launcher: start vite, wait for it, compile the electron main process,
// then launch electron pointing at the dev server (hybrid mode).
import {spawn} from 'child_process';
import {once} from 'events';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const URL = process.env.ELECTRON_RENDERER_URL || 'http://localhost:8080';

const children = [];
function spawnChild(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {stdio: 'inherit', shell: process.platform === 'win32', ...opts});
  children.push(child);
  return child;
}

function cleanup() {
  for (const c of children) {
    try {
      c.kill();
    } catch {}
  }
}
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('exit', cleanup);

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`dev server not reachable at ${url}`);
}

async function run(cmd, args) {
  const child = spawnChild(cmd, args);
  const [code] = await once(child, 'exit');
  if (code) throw new Error(`${cmd} exited with ${code}`);
}

// vite keeps running; don't await it
spawnChild('pnpm', ['dev']);
await waitForServer(URL);

// compile main + preload
await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.electron.json']);

const electron = require('electron');
const app = spawnChild(electron, ['.'], {env: {...process.env, ELECTRON_RENDERER_URL: URL}});
app.on('exit', () => {
  cleanup();
  process.exit(0);
});
